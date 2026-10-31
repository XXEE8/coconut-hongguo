
/*
 * Coconut 红果短剧 v0.3.6
 *
 * 搜索响应诊断版
 *
 * 诊断：
 * - HTTP 状态
 * - 最终 URL
 * - Content-Type
 * - 响应长度
 * - HTML / JSON 标记
 * - 响应前 150 字符
 *
 * 详情及播放逻辑沿用 v0.3.1
 */

var HG_BASE = "https://hongguoduanju.com";

var HG_UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) " +
  "AppleWebKit/537.36 (KHTML, like Gecko) " +
  "Chrome/140.0.0.0 Safari/537.36";

var HG_SERIES = {};
var HG_CACHE = {};

var HG_TEST_KEYWORD = "归路";

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
  var response = await fetch(url, options || {
    method: "GET",
    headers: hgHeaders(false)
  });

  if (!response.ok) {
    throw Error("HTTP " + response.status);
  }

  return response;
}

function hgParse(html) {
  var pos = html.indexOf("_ROUTER_DATA");

  if (pos < 0) {
    throw Error("页面缺少 _ROUTER_DATA");
  }

  var start = html.indexOf("{", pos);

  if (start < 0) {
    throw Error("页面缺少 JSON");
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
    depth > 8
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

/*
 * 诊断卡片
 *
 * 使用数字 ID 只是为了符合首页结构。
 * 诊断卡片不是实际短剧，不要点击。
 */

function hgDiag(title, detail) {
  var card = {
    id: "999999999999999999",
    title: hgS(title),
    name: hgS(title),
    cover: "",
    description: hgS(detail)
  };

  return {
    list: [card],
    items: [card],
    videos: [card]
  };
}

function hgCleanText(value) {
  return hgS(value)
    .replace(/\s+/g, " ")
    .replace(/[\u0000-\u001f]/g, " ")
    .trim();
}

/*
 * 直接读取 HTTP Response
 * 不调用 hgPage，避免提前抛出解析错误。
 */

var home = async function () {
  var url =
    HG_BASE +
    "/search/" +
    encodeURIComponent(HG_TEST_KEYWORD);

  var response;

  try {
    response = await fetch(url, {
      method: "GET",
      headers: hgHeaders(false)
    });
  } catch (e) {
    return hgDiag(
      "请求异常：" + hgErr(e),
      "URL：" + url
    );
  }

  var status = hgS(response.status);
  var finalURL = hgS(response.url || url);

  var contentType = "";

  try {
    contentType = hgS(
      response.headers.get("content-type")
    );
  } catch (e) {
    contentType = "无法读取";
  }

  var body = "";

  try {
    body = await response.text();
  } catch (e) {
    return hgDiag(
      "读取正文失败：" + hgErr(e),
      "HTTP：" + status
    );
  }

  var hasRouter =
    body.indexOf("_ROUTER_DATA") >= 0;

  var hasSearchList =
    body.indexOf("searchList") >= 0;

  var hasHTML =
    /<html|<!doctype html/i.test(body);

  var trimmed = body.trim();

  var hasJSON =
    trimmed.charAt(0) === "{" ||
    trimmed.charAt(0) === "[";

  var snippet = hgCleanText(
    body.slice(0, 150)
  );

  /*
   * 使用多张首页卡片分别展示诊断信息，
   * 避免单张卡片标题过长被截断。
   */

  var diagnostics = [
    {
      title: "01 HTTP：" + status,
      description: "请求：" + url
    },
    {
      title: "02 类型：" +
        (contentType || "未提供"),
      description: "Content-Type"
    },
    {
      title: "03 长度：" + body.length,
      description: "响应字符数"
    },
    {
      title:
        "04 标记 R:" + (hasRouter ? "有" : "无") +
        " S:" + (hasSearchList ? "有" : "无") +
        " H:" + (hasHTML ? "有" : "无") +
        " J:" + (hasJSON ? "有" : "无"),
      description:
        "R=路由 S=搜索列表 H=HTML J=JSON"
    },
    {
      title: "05 开头：" +
        (snippet.slice(0, 65) || "空正文"),
      description: snippet
    },
    {
      title: "06 最终地址：" +
        finalURL.slice(0, 80),
      description: finalURL
    }
  ];

  var cards = [];

  for (var i = 0; i < diagnostics.length; i++) {
    var d = diagnostics[i];

    cards.push({
      id: "99999999999999999" + (i + 1),
      title: d.title,
      name: d.title,
      cover: "",
      description: d.description
    });
  }

  return {
    list: cards,
    items: cards,
    videos: cards
  };
};

/*
 * 以下详情、选集、播放逻辑沿用 v0.3.1
 */

/* 详情 */

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

/* Coconut 播放 */

var extractStreamUrl = async function (input) {
  var vid = hgId(input);

  if (!/^\d+$/.test(vid)) {
    throw Error(
      "v0.3.1：无效 VID"
    );
  }

  var seriesId = HG_SERIES[vid] || "";
  var errors = [];

  /*
   * 保留公开播放方式。
   */

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

  /*
   * 官网未加密 MP4 兜底。
   */

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

  /*
   * 官网 play-info。
   */

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
