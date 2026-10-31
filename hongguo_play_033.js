/*
 * Coconut 红果短剧 v0.3.3
 *
 * 真实首页 / 真实搜索 / 详情 / 选集
 * 保留 v0.3.1 网页播放线路
 * 不需要账号登录
 *
 * 注意：
 * 受限剧集仍可能返回 HTTP 403。
 * search 函数是否被 Coconut 识别，
 * 需要在实际 App 中验证。
 */

var HG_BASE = "https://hongguoduanju.com";

var HG_UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) " +
  "AppleWebKit/537.36 (KHTML, like Gecko) " +
  "Chrome/140.0.0.0 Safari/537.36";

var HG_SERIES = {};
var HG_CACHE = {};

function hs(v) {
  return v == null ? "" : String(v);
}

function hp(o, keys) {
  if (!o || typeof o !== "object") return "";
  for (var i = 0; i < keys.length; i++) {
    var v = o[keys[i]];
    if (v !== undefined && v !== null && v !== "") {
      return v;
    }
  }
  return "";
}

function he(e) {
  return hs(e && e.message ? e.message : e);
}

function hh(json) {
  var headers = {
    "User-Agent": HG_UA,
    "Referer": HG_BASE + "/",
    "Accept": json
      ? "application/json"
      : "text/html,application/xhtml+xml"
  };
  if (json) {
    headers["Content-Type"] = "application/json";
  }
  return headers;
}

async function hFetch(url, options) {
  var response = await fetch(
    url,
    options || {
      method: "GET",
      headers: hh(false)
    }
  );
  if (!response.ok) {
    throw Error("HTTP " + response.status);
  }
  return response;
}

function hParse(html) {
  var pos = html.indexOf("_ROUTER_DATA");
  if (pos < 0) throw Error("缺少路由数据");

  var start = html.indexOf("{", pos);
  if (start < 0) throw Error("缺少 JSON");

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

async function hPage(url) {
  var r = await hFetch(url);
  return hParse(await r.text());
}

async function hPost(path, body) {
  var r = await hFetch(HG_BASE + path, {
    method: "POST",
    headers: hh(true),
    body: JSON.stringify(body)
  });
  return await r.json();
}

function hFind(obj, test, depth) {
  if (!obj || typeof obj !== "object" || depth > 8) {
    return null;
  }

  if (test(obj)) return obj;

  var keys = Object.keys(obj);

  for (var i = 0; i < keys.length; i++) {
    var k = keys[i];
    if (/^(req|request|headers)$/.test(k)) {
      continue;
    }

    var found = hFind(obj[k], test, depth + 1);
    if (found) return found;
  }
  return null;
}

function hId(item) {
  if (typeof item === "string" ||
      typeof item === "number") {
    return hs(item);
  }

  return hs(hp(item, [
    "id", "vid", "video_id",
    "videoId", "series_id", "seriesId"
  ]));
}

function hCard(entry) {
  if (!entry || typeof entry !== "object") {
    return null;
  }

  var v =
    entry.video_data ||
    entry.videoData ||
    entry;

  var id = hs(hp(v, [
    "series_id", "seriesId",
    "book_id", "bookId"
  ]) || hp(entry, ["series_id", "seriesId"]));

  if (!id) return null;

  var title = hs(hp(v, [
    "series_name", "seriesName",
    "book_name", "title", "name"
  ]) || hp(entry, ["title", "name"]));

  var cover = hs(hp(v, [
    "series_cover", "seriesCover",
    "cover", "cover_url", "book_cover"
  ]) || hp(entry, ["cover"]));

  var desc = hs(hp(v, [
    "series_intro", "description",
    "intro", "abstract"
  ]));

  var card = {
    id: id,
    title: title || "未命名短剧",
    name: title || "未命名短剧",
    cover: cover,
    description: desc
  };

  HG_CACHE[id] = card;
  return card;
}

function hCards(list) {
  var cards = [];
  var seen = {};

  for (var i = 0; i < list.length; i++) {
    var card = hCard(list[i]);
    if (card && !seen[card.id]) {
      seen[card.id] = true;
      cards.push(card);
    }
  }

  return cards;
}

function hResult(cards) {
  return {
    list: cards,
    items: cards,
    videos: cards
  };
}

/* 首页 */

var home = async function () {
  var urls = [
    HG_BASE + "/category/real-drama?page=1",
    HG_BASE + "/category?tab=1&sort_type=1"
  ];

  var errors = [];

  for (var i = 0; i < urls.length; i++) {
    try {
      var router = await hPage(urls[i]);

      var node = hFind(
        router.loaderData || {},
        function (o) {
          return Array.isArray(o.recommendList) &&
            o.recommendList.length > 0;
        },
        0
      );

      if (!node) continue;

      var cards = hCards(node.recommendList);
      if (cards.length) return hResult(cards);

    } catch (e) {
      errors.push(he(e));
    }
  }

  return hResult([{
    id: "diag033",
    title: "首页加载失败",
    name: "首页加载失败",
    cover: "",
    description: errors.join("；")
  }]);
};

/*
 * 真实搜索
 *
 * 来源：AngelLive v1.1.0
 * GET /search/{keyword}
 *
 * Coconut 是否支持 search 函数
 * 需要安装后确认。
 */

var search = async function (input) {
  var keyword = "";

  if (typeof input === "string") {
    keyword = input.trim();
  } else if (input && typeof input === "object") {
    keyword = hs(hp(input, [
      "keyword", "query", "q", "text"
    ])).trim();
  }

  if (!keyword) {
    return hResult([]);
  }

  var router = await hPage(
    HG_BASE + "/search/" +
    encodeURIComponent(keyword)
  );

  var node = hFind(
    router.loaderData || {},
    function (o) {
      return Array.isArray(o.searchList);
    },
    0
  );

  if (!node || node.isSuccess === false) {
    return hResult([]);
  }

  return hResult(hCards(node.searchList));
};

/* 详情和选集 */

var extractDetails = async function (item) {
  var seriesId = hId(item);

  if (!/^\d+$/.test(seriesId)) {
    throw Error("无效 series_id");
  }

  var router = await hPage(
    HG_BASE + "/detail?series_id=" +
    encodeURIComponent(seriesId)
  );

  var node = hFind(
    router.loaderData || {},
    function (o) {
      return !!(
        o.seriesDetail &&
        typeof o.seriesDetail === "object"
      );
    },
    0
  );

  if (!node) {
    throw Error("没有找到 seriesDetail");
  }

  var d = node.seriesDetail;
  var cached = HG_CACHE[seriesId] || {};

  var title = hs(hp(d, [
    "series_name", "series_title", "title"
  ]) || cached.title);

  var cover = hs(hp(d, [
    "series_cover", "cover"
  ]) || cached.cover);

  var desc = hs(hp(d, [
    "series_intro", "description", "intro"
  ]) || cached.description);

  var raw = d.vid_list || [];

  if (!Array.isArray(raw)) {
    raw = raw && typeof raw === "object"
      ? Object.values(raw)
      : [];
  }

  var episodes = [];

  for (var i = 0; i < raw.length; i++) {
    var entry = raw[i];

    var vid = typeof entry === "object"
      ? hs(hp(entry, [
          "vid", "video_id", "videoId", "id"
        ]))
      : hs(entry);

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
    throw Error("没有解析到剧集");
  }

  var count = Number(
    d.episode_cnt || episodes.length
  );

  if (!Number.isFinite(count)) {
    count = episodes.length;
  }

  if (d.accessible_episode_cnt != null) {
    desc += "\n官网标记可访问集数：" +
      d.accessible_episode_cnt;
  }

  desc += "\n总集数：" + count;

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

/* 播放资源 */

function hURL(value) {
  if (typeof value !== "string") return "";

  var url = value.trim();
  if (url.indexOf("//") === 0) {
    url = "https:" + url;
  }

  return /^https?:\/\/\S+$/i.test(url)
    ? url
    : "";
}

function hMedia(info) {
  if (!info) return "";

  if (typeof info === "string") {
    return hURL(info);
  }

  var fields = [
    "main_url", "backup_url",
    "backup_url_1", "play_url",
    "video_url", "url"
  ];

  for (var i = 0; i < fields.length; i++) {
    var v = info[fields[i]];

    if (typeof v === "string") {
      var url = hURL(v);
      if (url) return url;
    }

    if (v && typeof v === "object") {
      var nested = hURL(
        v.main_url || v.url
      );
      if (nested) return nested;
    }
  }

  return "";
}

/* 网页公开流 */

async function hWeb(seriesId, vid) {
  var router = await hPage(
    HG_BASE + "/player/" +
    encodeURIComponent(seriesId) + "/" +
    encodeURIComponent(vid)
  );

  var node = hFind(
    router.loaderData || {},
    function (o) {
      return !!(
        o.video_player_info ||
        o.publicVideoSeo
      );
    },
    0
  );

  if (!node || node.isSuccess === false) {
    throw Error("播放页无有效媒体");
  }

  if (node.vid && hs(node.vid) !== vid) {
    throw Error("播放页 VID 不匹配");
  }

  if (node.series_id &&
      hs(node.series_id) !== seriesId) {
    throw Error("播放页 series_id 不匹配");
  }

  var url = hMedia(node.video_player_info);
  if (url) return url;

  var seo = node.publicVideoSeo;

  if (
    seo &&
    seo.available === true &&
    hs(seo.seriesId) === seriesId &&
    hs(seo.itemId) === vid
  ) {
    return HG_BASE +
      "/video/public/" +
      encodeURIComponent(vid) +
      "/360p.mp4";
  }

  throw Error("没有公开播放地址");
}

/* 官网 MP4 兜底 */

async function hFallback(vid) {
  var data = await hPost(
    "/api/video/protected/fallback-play-info",
    { item_id: vid }
  );

  var url = hURL(data && data.main_url);

  if (!url) {
    throw Error("没有 main_url");
  }

  return url;
}

/* 官网 play-info */

async function hProtected(seriesId, vid) {
  var definitions = [
    "720p", "480p", "360p"
  ];

  var errors = [];

  for (var i = 0; i < definitions.length; i++) {
    try {
      var data = await hPost(
        "/api/video/protected/play-info",
        {
          series_id: seriesId,
          item_id: vid,
          definition: definitions[i]
        }
      );

      var info = data && data.play_info;

      if (!info) {
        throw Error("没有 play_info");
      }

      if (
        info.encrypted === true ||
        info.is_encrypted === true ||
        info.drm ||
        info.decryption ||
        info.player_access_key
      ) {
        throw Error("资源需要额外解密");
      }

      var url = hMedia(info);
      if (url) return url;

      throw Error("没有媒体地址");

    } catch (e) {
      errors.push(
        definitions[i] + ":" + he(e)
      );
    }
  }

  throw Error(errors.join("；"));
}

/* Coconut 播放函数 */

var extractStreamUrl = async function (input) {
  var vid = hId(input);

  if (!/^\d+$/.test(vid)) {
    throw Error("v0.3.3：无效 VID");
  }

  var seriesId = HG_SERIES[vid] || "";
  var errors = [];

  if (seriesId) {
    try {
      var web = await hWeb(seriesId, vid);
      if (web) return { url: web };
    } catch (e) {
      errors.push("网页：" + he(e));
    }
  } else {
    errors.push("缺少 series_id");
  }

  try {
    var fallback = await hFallback(vid);
    if (fallback) return { url: fallback };
  } catch (e) {
    errors.push("MP4兜底：" + he(e));
  }

  if (seriesId) {
    try {
      var protectedURL = await hProtected(
        seriesId, vid
      );
      if (protectedURL) {
        return { url: protectedURL };
      }
    } catch (e) {
      errors.push("play-info：" + he(e));
    }
  }

  throw Error(
    "v0.3.3 播放失败；" +
    errors.join(" | ").slice(0, 650)
  );
};
