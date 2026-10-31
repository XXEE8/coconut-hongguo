
/*
 * Coconut 红果短剧 v0.3.9
 *
 * 修复搜索 URL：
 * /search/关键词?page=1
 *
 * 先获取真实搜索结果
 * 搜索失败自动恢复真人剧首页
 *
 * 详情、选集、播放沿用 v0.3.1
 * 无登录
 */

var HG_BASE = "https://hongguoduanju.com";

var HG_UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) " +
  "AppleWebKit/537.36 (KHTML, like Gecko) " +
  "Chrome/140.0.0.0 Safari/537.36";

var HG_SERIES = {};
var HG_CACHE = {};
var HG_KEYWORD = "归路";

function hgS(v) {
  return v == null ? "" : String(v);
}

function hgPick(o, keys) {
  if (!o || typeof o !== "object") return "";
  for (var i = 0; i < keys.length; i++) {
    var v = o[keys[i]];
    if (v !== undefined && v !== null && v !== "") {
      return v;
    }
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

  if (json) {
    headers["Content-Type"] = "application/json";
  }
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

  if (!response.ok) {
    throw Error("HTTP " + response.status);
  }

  return response;
}

function hgParse(html) {
  var match = html.match(
    /(?:window\.)?_ROUTER_DATA\s*=\s*/
  );

  if (!match) {
    throw Error("页面缺少 _ROUTER_DATA");
  }

  var start = match.index + match[0].length;

  while (
    start < html.length &&
    /\s/.test(html[start])
  ) {
    start++;
  }

  if (html[start] !== "{") {
    throw Error("路由数据不是 JSON 对象");
  }

  var depth = 0;
  var quoted = false;
  var escaped = false;

  for (var i = start; i < html.length; i++) {
    var c = html[i];

    if (quoted) {
      if (escaped) {
        escaped = false;
      } else if (c === "\\") {
        escaped = true;
      } else if (c === '"') {
        quoted = false;
      }
    } else if (c === '"') {
      quoted = true;
    } else if (c === "{") {
      depth++;
    } else if (c === "}") {
      depth--;
      if (depth === 0) {
        return JSON.parse(
          html.slice(start, i + 1)
        );
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
  var response = await hgRequest(
    HG_BASE + path,
    {
      method: "POST",
      headers: hgHeaders(true),
      body: JSON.stringify(body)
    }
  );
  return await response.json();
}

function hgFind(obj, predicate, depth) {
  if (
    !obj ||
    typeof obj !== "object" ||
    depth > 10
  ) {
    return null;
  }

  if (predicate(obj)) return obj;

  var keys = Object.keys(obj);

  for (var i = 0; i < keys.length; i++) {
    var key = keys[i];

    if (/^(req|request|headers)$/.test(key)) {
      continue;
    }

    var found = hgFind(
      obj[key],
      predicate,
      depth + 1
    );

    if (found) return found;
  }

  return null;
}

function hgId(item) {
  if (
    typeof item === "string" ||
    typeof item === "number"
  ) {
    return hgS(item);
  }

  return hgS(hgPick(item, [
    "id",
    "vid",
    "video_id",
    "videoId",
    "series_id",
    "seriesId"
  ]));
}

function hgURL(value) {
  if (typeof value !== "string") return "";

  var url = value.trim();

  if (url.indexOf("//") === 0) {
    url = "https:" + url;
  }

  return /^https?:\/\/\S+$/i.test(url)
    ? url
    : "";
}

function hgMedia(info) {
  if (!info) return "";

  if (typeof info === "string") {
    return hgURL(info);
  }

  var fields = [
    "main_url",
    "backup_url",
    "backup_url_1",
    "play_url",
    "video_url",
    "url"
  ];

  for (var i = 0; i < fields.length; i++) {
    var value = info[fields[i]];

    if (typeof value === "string") {
      var url = hgURL(value);
      if (url) return url;
    }

    if (value && typeof value === "object") {
      var nested = hgURL(
        value.main_url || value.url
      );

      if (nested) return nested;
    }
  }

  return "";
}

/* 卡片转换 */

function hgCard(entry) {
  if (!entry || typeof entry !== "object") {
    return null;
  }

  var v =
    entry.video_data ||
    entry.videoData ||
    entry;

  var id = hgS(hgPick(v, [
    "series_id",
    "seriesId",
    "book_id"
  ]));

  if (!/^\d+$/.test(id)) {
    return null;
  }

  var title = hgS(hgPick(v, [
    "series_name",
    "seriesName",
    "series_title",
    "title",
    "name"
  ]));

  var cover = hgS(hgPick(v, [
    "series_cover",
    "seriesCover",
    "cover",
    "cover_url"
  ]));

  var card = {
    id: id,
    title: title || "未命名短剧",
    name: title || "未命名短剧",
    cover: cover,
    description: hgS(hgPick(v, [
      "series_intro",
      "description",
      "intro"
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

function hgStatus(message) {
  return {
    id: "999999999999999999",
    title: "搜索状态：" + message,
    name: "搜索状态：" + message,
    cover: "",
    description: message
  };
}

/* 正确的官网搜索 URL */

async function hgSearch(keyword) {
  var url =
    HG_BASE +
    "/search/" +
    encodeURIComponent(keyword) +
    "?page=1";

  var response = await hgRequest(url);
  var html = await response.text();

  var router;

  try {
    router = hgParse(html);
  } catch (e) {
    throw Error(
      hgErr(e) +
      "；HTTP=" + response.status +
      "；长度=" + html.length +
      "；searchList=" +
      (html.indexOf("searchList") >= 0
        ? "有" : "无")
    );
  }

  var node = hgFind(
    router.loaderData || {},
    function (o) {
      return Array.isArray(o.searchList);
    },
    0
  );

  if (!node) {
    throw Error(
      "已解析路由，但没有 searchList"
    );
  }

  if (node.isSuccess === false) {
    throw Error("搜索接口返回失败");
  }

  return hgCards(node.searchList);
}

/* v0.3.1 真人剧首页 */

async function hgOriginalHome() {
  var urls = [
    HG_BASE + "/category/real-drama?page=1",
    HG_BASE + "/category?tab=1&sort_type=1"
  ];

  var errors = [];

  for (var i = 0; i < urls.length; i++) {
    try {
      var router = await hgPage(urls[i]);

      var node = hgFind(
        router.loaderData || {},
        function (o) {
          return Array.isArray(o.recommendList) &&
            o.recommendList.length > 0;
        },
        0
      );

      if (!node) continue;

      var cards = hgCards(node.recommendList);

      if (cards.length) {
        return cards;
      }
    } catch (e) {
      errors.push(hgErr(e));
    }
  }

  throw Error(errors.join("；"));
}

/*
 * 首页：
 *
 * 搜索成功：显示真实搜索结果。
 * 搜索失败：恢复原版真人剧首页。
 */

var home = async function () {
  var searchError = "";

  try {
    var results = await hgSearch(HG_KEYWORD);

    if (results.length) {
      return hgResult(results);
    }

    searchError = "搜索结果为空";

  } catch (e) {
    searchError = hgErr(e);
  }

  try {
    var original = await hgOriginalHome();

    original.unshift(
      hgStatus(
        searchError.slice(0, 160)
      )
    );

    return hgResult(original);

  } catch (e) {
    return hgResult([
      hgStatus(
        "搜索：" + searchError +
        "；首页：" + hgErr(e)
      )
    ]);
  }
};

/* 详情：保持 v0.3.1 */

var extractDetails = async function (item) {
  var seriesId = hgId(item);

  if (!/^\d+$/.test(seriesId)) {
    throw Error("无效 series_id");
  }

  var router = await hgPage(
    HG_BASE +
    "/detail?series_id=" +
    encodeURIComponent(seriesId)
  );

  var node = hgFind(
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
    throw Error("找不到 seriesDetail");
  }

  var detail = node.seriesDetail;
  var cached = HG_CACHE[seriesId] || {};

  var title = hgS(hgPick(detail, [
    "series_name",
    "series_title",
    "title"
  ]) || cached.title);

  var cover = hgS(hgPick(detail, [
    "series_cover",
    "cover"
  ]) || cached.cover);

  var desc = hgS(hgPick(detail, [
    "series_intro",
    "description",
    "intro"
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
          "vid",
          "video_id",
          "videoId",
          "id"
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

/* 官网公开播放页 */

async function hgWeb(seriesId, vid) {
  var router = await hgPage(
    HG_BASE +
    "/player/" +
    encodeURIComponent(seriesId) +
    "/" +
    encodeURIComponent(vid)
  );

  var page = hgFind(
    router.loaderData || {},
    function (o) {
      return !!(
        o.video_player_info ||
        o.publicVideoSeo
      );
    },
    0
  );

  if (!page) {
    throw Error("没有播放页数据");
  }

  if (
    page.vid &&
    hgS(page.vid) !== vid
  ) {
    throw Error("播放页 VID 不匹配");
  }

  if (
    page.series_id &&
    hgS(page.series_id) !== seriesId
  ) {
    throw Error("播放页 series_id 不匹配");
  }

  var url = hgMedia(page.video_player_info);

  if (url) return url;

  var seo = page.publicVideoSeo;

  if (
    seo &&
    seo.available === true &&
    hgS(seo.seriesId) === seriesId &&
    hgS(seo.itemId) === vid
  ) {
    return (
      HG_BASE +
      "/video/public/" +
      encodeURIComponent(vid) +
      "/360p.mp4"
    );
  }

  throw Error("没有公开媒体地址");
}

/* 官网 MP4 兜底 */

async function hgFallback(vid) {
  var data = await hgPost(
    "/api/video/protected/fallback-play-info",
    {
      item_id: vid
    }
  );

  var url = hgURL(
    data && data.main_url
  );

  if (!url) {
    throw Error("没有 main_url");
  }

  return url;
}

/* 官网受保护视频接口 */

async function hgProtected(seriesId, vid) {
  var definitions = [
    "720p",
    "480p",
    "360p"
  ];

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

      if (!info) {
        throw Error("没有 play_info");
      }

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

      if (!url) {
        throw Error("没有媒体地址");
      }

      return url;

    } catch (e) {
      errors.push(
        definition + ":" + hgErr(e)
      );
    }
  }

  throw Error(errors.join("；"));
}

/* Coconut 播放：保持 v0.3.1 */

var extractStreamUrl = async function (input) {
  var vid = hgId(input);

  if (!/^\d+$/.test(vid)) {
    throw Error(
      "v0.3.1：无效 VID"
    );
  }

  var seriesId = HG_SERIES[vid] || "";
  var errors = [];

  if (seriesId) {
    try {
      var publicURL = await hgWeb(
        seriesId,
        vid
      );

      if (publicURL) {
        return {
          url: publicURL
        };
      }

    } catch (e) {
      errors.push(
        "网页：" + hgErr(e)
      );
    }
  } else {
    errors.push("没有 series_id");
  }

  try {
    var fallbackURL = await hgFallback(vid);

    if (fallbackURL) {
      return {
        url: fallbackURL
      };
    }

  } catch (e) {
    errors.push(
      "MP4兜底：" + hgErr(e)
    );
  }

  if (seriesId) {
    try {
      var protectedURL = await hgProtected(
        seriesId,
        vid
      );

      if (protectedURL) {
        return {
          url: protectedURL
        };
      }

    } catch (e) {
      errors.push(
        "play-info：" + hgErr(e)
      );
    }
  }

  throw Error(
    "v0.3.1 播放失败；" +
    errors.join(" | ").slice(0, 650)
  );
};
