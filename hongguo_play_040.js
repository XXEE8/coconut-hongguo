
/*
 * Coconut 红果短剧 v0.4.0
 *
 * 1. 保留 v0.3.1 首页、详情和播放
 * 2. 新增搜索回调（兼容多种参数形式）
 * 3. 支持 series_id 和红果详情链接搜索
 * 4. 搜索失败不影响首页
 * 5. 不需要登录
 *
 * 注意：Coconut 是否调用 search 回调
 * 仍需实际测试。
 */

var HG_BASE = "https://hongguoduanju.com";

var HG_UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) " +
  "AppleWebKit/537.36 (KHTML, like Gecko) " +
  "Chrome/140.0.0.0 Safari/537.36";

var HG_SERIES = {};
var HG_CACHE = {};

function hgS(v) {
  return v == null ? "" : String(v);
}

function hgPick(o, keys) {
  if (!o || typeof o !== "object") return "";
  for (var i = 0; i < keys.length; i++) {
    var v = o[keys[i]];
    if (v !== undefined && v !== null && v !== "") return v;
  }
  return "";
}

function hgErr(e) {
  return hgS(e && e.message ? e.message : e);
}

function hgHeaders(json) {
  var headers = {
    "Accept": json
      ? "application/json"
      : "text/html,application/xhtml+xml",
    "Referer": HG_BASE + "/",
    "User-Agent": HG_UA
  };
  if (json) headers["Content-Type"] = "application/json";
  return headers;
}

async function hgRequest(url, options) {
  var response = await fetch(
    url,
    options || {
      method: "GET",
      headers: hgHeaders(false)
    }
  );
  if (!response.ok) throw Error("HTTP " + response.status);
  return response;
}

function hgParse(html) {
  var pos = html.indexOf("_ROUTER_DATA");
  if (pos < 0) throw Error("页面缺少 _ROUTER_DATA");

  var start = html.indexOf("{", pos);
  if (start < 0) throw Error("页面缺少 JSON");

  var depth = 0;
  var quoted = false;
  var escaped = false;

  for (var i = start; i < html.length; i++) {
    var c = html[i];

    if (quoted) {
      if (escaped) escaped = false;
      else if (c === "\\") escaped = true;
      else if (c === '"') quoted = false;
    } else if (c === '"') {
      quoted = true;
    } else if (c === "{") {
      depth++;
    } else if (c === "}") {
      depth--;
      if (depth === 0) {
        return JSON.parse(html.slice(start, i + 1));
      }
    }
  }
  throw Error("路由 JSON 不完整");
}

async function hgPage(url) {
  var response = await hgRequest(url);
  return hgParse(await response.text());
}

async function hgPost(path, body) {
  var response = await hgRequest(HG_BASE + path, {
    method: "POST",
    headers: hgHeaders(true),
    body: JSON.stringify(body)
  });
  return await response.json();
}

function hgFind(obj, predicate, depth) {
  if (!obj || typeof obj !== "object" || depth > 8) {
    return null;
  }
  if (predicate(obj)) return obj;

  var keys = Object.keys(obj);
  for (var i = 0; i < keys.length; i++) {
    var key = keys[i];
    if (/^(req|request|headers)$/.test(key)) continue;
    var found = hgFind(obj[key], predicate, depth + 1);
    if (found) return found;
  }
  return null;
}

function hgId(item) {
  if (
    typeof item === "string" ||
    typeof item === "number"
  ) return hgS(item);

  return hgS(hgPick(item, [
    "id", "vid", "video_id",
    "videoId", "series_id", "seriesId"
  ]));
}

function hgURL(value) {
  if (typeof value !== "string") return "";
  var url = value.trim();
  if (url.indexOf("//") === 0) url = "https:" + url;
  return /^https?:\/\/\S+$/i.test(url) ? url : "";
}

function hgMedia(info) {
  if (!info) return "";
  if (typeof info === "string") return hgURL(info);

  var fields = [
    "main_url", "backup_url", "backup_url_1",
    "play_url", "video_url", "url"
  ];

  for (var i = 0; i < fields.length; i++) {
    var value = info[fields[i]];
    if (typeof value === "string") {
      var url = hgURL(value);
      if (url) return url;
    }
    if (value && typeof value === "object") {
      var nested = hgURL(value.main_url || value.url);
      if (nested) return nested;
    }
  }
  return "";
}

function hgCard(entry) {
  if (!entry || typeof entry !== "object") return null;

  var v = entry.video_data || entry.videoData || entry;

  var id = hgS(hgPick(v, [
    "series_id", "seriesId", "book_id"
  ]));

  if (!/^\d+$/.test(id)) return null;

  var title = hgS(hgPick(v, [
    "series_name", "seriesName",
    "series_title", "title", "name"
  ]));

  var cover = hgS(hgPick(v, [
    "series_cover", "seriesCover",
    "cover", "cover_url"
  ]));

  var card = {
    id: id,
    title: title || "未命名短剧",
    name: title || "未命名短剧",
    cover: cover,
    description: hgS(hgPick(v, [
      "series_intro", "description", "intro"
    ]))
  };

  HG_CACHE[id] = card;
  return card;
}

function hgCards(raw) {
  var cards = [];
  var seen = {};

  for (var i = 0; i < raw.length; i++) {
    var card = hgCard(raw[i]);
    if (card && !seen[card.id]) {
      seen[card.id] = true;
      cards.push(card);
    }
  }
  return cards;
}

function hgResult(cards) {
  return {
    list: cards,
    items: cards,
    videos: cards
  };
}

/* 首页：恢复 v0.3.1 已验证逻辑 */

var home = async function () {
  var urls = [
    HG_BASE + "/category/real-drama?page=1",
    HG_BASE + "/category?tab=1&sort_type=1"
  ];

  var errors = [];

  for (var n = 0; n < urls.length; n++) {
    try {
      var router = await hgPage(urls[n]);

      var node = hgFind(
        router.loaderData || {},
        function(o) {
          return Array.isArray(o.recommendList) &&
            o.recommendList.length > 0;
        },
        0
      );

      if (!node) continue;

      var cards = hgCards(node.recommendList);
      if (cards.length) return hgResult(cards);

    } catch (e) {
      errors.push(hgErr(e));
    }
  }

  var error = {
    id: "diag040",
    title: "首页失败",
    name: "首页失败",
    cover: "",
    description: errors.join("；")
  };

  return hgResult([error]);
};

/*
 * 搜索功能
 *
 * 兼容：
 * search("归路")
 * search({keyword:"归路"})
 * search({query:"归路"})
 * search({wd:"归路"})
 *
 * 还支持：
 * 纯数字 series_id
 * /detail?series_id=123
 * /player/123/456
 */

function hgKeyword(payload) {
  if (
    typeof payload === "string" ||
    typeof payload === "number"
  ) return hgS(payload).trim();

  return hgS(hgPick(payload, [
    "keyword", "query", "wd",
    "text", "searchText", "searchTerm",
    "name"
  ])).trim();
}

function hgSeriesFromKeyword(keyword) {
  if (/^\d+$/.test(keyword)) return keyword;

  var match = keyword.match(
    /[?&]series_id=(\d+)/
  );
  if (match) return match[1];

  match = keyword.match(
    /\/player\/(\d+)\/\d+/
  );
  if (match) return match[1];

  return "";
}

async function hgSearchById(seriesId) {
  var router = await hgPage(
    HG_BASE + "/detail?series_id=" +
    encodeURIComponent(seriesId)
  );

  var node = hgFind(
    router.loaderData || {},
    function(o) {
      return !!(
        o.seriesDetail &&
        typeof o.seriesDetail === "object"
      );
    },
    0
  );

  if (!node) throw Error("找不到 seriesDetail");

  var detail = node.seriesDetail;

  var card = hgCard(
    Object.assign({}, detail, {
      series_id: seriesId
    })
  );

  return card ? [card] : [];
}

async function hgSearchByName(keyword) {
  var url = HG_BASE + "/search/" +
    encodeURIComponent(keyword);

  var router = await hgPage(url);

  var node = hgFind(
    router.loaderData || {},
    function(o) {
      return Array.isArray(o.searchList);
    },
    0
  );

  if (!node || node.isSuccess === false) {
    throw Error("没有搜索列表");
  }

  return hgCards(node.searchList);
}

var search = async function(payload) {
  var keyword = hgKeyword(payload);

  if (!keyword) return hgResult([]);

  var page = payload &&
    typeof payload === "object"
    ? Number(payload.page || 1)
    : 1;

  if (page > 1) return hgResult([]);

  var seriesId = hgSeriesFromKeyword(keyword);

  try {
    var cards = seriesId
      ? await hgSearchById(seriesId)
      : await hgSearchByName(keyword);

    return hgResult(cards);

  } catch (e) {
    return hgResult([{
      id: "search_error_040",
      title: "搜索失败：" + hgErr(e),
      name: "搜索失败：" + hgErr(e),
      cover: "",
      description:
        "关键词：" + keyword +
        "\n" + hgErr(e)
    }]);
  }
};

/* 额外暴露搜索别名，兼容性待验证 */

var searchVideos = search;
var searchVideo = search;

/* 详情：v0.3.1 */

var extractDetails = async function(item) {
  var seriesId = hgId(item);

  if (!/^\d+$/.test(seriesId)) {
    throw Error("无效 series_id");
  }

  var router = await hgPage(
    HG_BASE + "/detail?series_id=" +
    encodeURIComponent(seriesId)
  );

  var node = hgFind(
    router.loaderData || {},
    function(o) {
      return !!(
        o.seriesDetail &&
        typeof o.seriesDetail === "object"
      );
    },
    0
  );

  if (!node) throw Error("找不到 seriesDetail");

  var detail = node.seriesDetail;
  var cached = HG_CACHE[seriesId] || {};

  var title = hgS(hgPick(detail, [
    "series_name", "series_title", "title"
  ]) || cached.title);

  var cover = hgS(hgPick(detail, [
    "series_cover", "cover"
  ]) || cached.cover);

  var desc = hgS(hgPick(detail, [
    "series_intro", "description", "intro"
  ]) || cached.description);

  var raw = detail.vid_list || [];

  if (!Array.isArray(raw)) {
    raw = raw && typeof raw === "object"
      ? Object.values(raw)
      : [];
  }

  var episodes = [];

  for (var i = 0; i < raw.length; i++) {
    var entry = raw[i];

    var vid = typeof entry === "object"
      ? hgS(hgPick(entry, [
          "vid", "video_id", "videoId", "id"
        ]))
      : hgS(entry);

    if (!vid) continue;

    HG_SERIES[vid] = seriesId;

    episodes.push({
      id: vid,
      title: "第" + (i + 1) + "集",
      name: "第" + (i + 1) + "集",
      episode: i + 1,
      index: i + 1
    });
  }

  if (!episodes.length) {
    throw Error("没有解析到 VID");
  }

  var count = Number(
    detail.episode_cnt || episodes.length
  );

  if (!Number.isFinite(count)) {
    count = episodes.length;
  }

  if (detail.accessible_episode_cnt != null) {
    desc += "\n公开集数：" +
      detail.accessible_episode_cnt;
  }

  desc += "\n总集数：" + count;
  desc += "\n已解析选集：" + episodes.length;

  return {
    id: seriesId,
    title: title,
    name: title,
    cover: cover,
    description: desc,
    episodeCount: count,
    episodes: episodes
  };
};

/* 播放：完全沿用 v0.3.1 的请求逻辑 */

async function hgWeb(seriesId, vid) {
  var router = await hgPage(
    HG_BASE + "/player/" +
    encodeURIComponent(seriesId) + "/" +
    encodeURIComponent(vid)
  );

  var page = hgFind(
    router.loaderData || {},
    function(o) {
      return !!(
        o.video_player_info ||
        o.publicVideoSeo
      );
    },
    0
  );

  if (!page) throw Error("没有播放页数据");

  if (
    page.vid &&
    hgS(page.vid) !== vid
  ) throw Error("播放页 VID 不匹配");

  if (
    page.series_id &&
    hgS(page.series_id) !== seriesId
  ) throw Error("播放页 series_id 不匹配");

  var url = hgMedia(page.video_player_info);
  if (url) return url;

  var seo = page.publicVideoSeo;

  if (
    seo &&
    seo.available === true &&
    hgS(seo.seriesId) === seriesId &&
    hgS(seo.itemId) === vid
  ) {
    return HG_BASE + "/video/public/" +
      encodeURIComponent(vid) + "/360p.mp4";
  }

  throw Error("没有公开媒体地址");
}

async function hgFallback(vid) {
  var data = await hgPost(
    "/api/video/protected/fallback-play-info",
    {item_id: vid}
  );

  var url = hgURL(data && data.main_url);

  if (!url) throw Error("没有 main_url");
  return url;
}

async function hgProtected(seriesId, vid) {
  var definitions = ["720p", "480p", "360p"];
  var errors = [];

  for (var i = 0; i < definitions.length; i++) {
    var definition = definitions[i];

    try {
      var data = await hgPost(
        "/api/video/protected/play-info",
        {
          series_id: seriesId,
          item_id: vid,
          definition: definition
        }
      );

      var info = data && data.play_info;

      if (!info) throw Error("没有 play_info");

      var key = hgS(
        info.player_access_key
      ).trim();

      if (
        info.encrypted === true ||
        info.is_encrypted === true ||
        info.drm ||
        info.decryption ||
        /^[0-9a-fA-F]{32}$/.test(key)
      ) {
        throw Error(
          "需要额外解密，当前模块不支持"
        );
      }

      var url = hgMedia(info);

      if (!url) throw Error("没有媒体地址");
      return url;

    } catch (e) {
      errors.push(
        definition + ":" + hgErr(e)
      );
    }
  }

  throw Error(errors.join("；"));
}

var extractStreamUrl = async function(input) {
  var vid = hgId(input);

  if (!/^\d+$/.test(vid)) {
    throw Error("v0.3.1：无效 VID");
  }

  var seriesId = HG_SERIES[vid] || "";
  var errors = [];

  if (seriesId) {
    try {
      var publicURL = await hgWeb(seriesId, vid);
      if (publicURL) return {url: publicURL};
    } catch (e) {
      errors.push("网页：" + hgErr(e));
    }
  } else {
    errors.push("没有 series_id");
  }

  try {
    var fallbackURL = await hgFallback(vid);
    if (fallbackURL) return {url: fallbackURL};
  } catch (e) {
    errors.push("MP4兜底：" + hgErr(e));
  }

  if (seriesId) {
    try {
      var protectedURL = await hgProtected(
        seriesId, vid
      );
      if (protectedURL) return {url: protectedURL};
    } catch (e) {
      errors.push("play-info：" + hgErr(e));
    }
  }

  throw Error(
    "v0.3.1 播放失败；" +
    errors.join(" | ").slice(0, 650)
  );
};
