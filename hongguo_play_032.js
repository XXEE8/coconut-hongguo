/*
 * Coconut 红果短剧 v0.3.2
 *
 * 真实首页 / 详情 / 选集
 * 公开播放页 + 会话重试
 * 官网 MP4 兜底 + play-info
 * 严格校验剧集 VID
 * 每集不设置封面
 *
 * 不需要红果账号登录
 */

var HG_BASE = "https://hongguoduanju.com";

var HG_UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) " +
  "AppleWebKit/537.36 (KHTML, like Gecko) " +
  "Chrome/140.0.0.0 Safari/537.36";

var HG_SERIES = {};
var HG_CACHE = {};

function hgStr(v) {
  return v == null ? "" : String(v);
}

function hgPick(o, names) {
  if (!o || typeof o !== "object") return "";

  for (var i = 0; i < names.length; i++) {
    var v = o[names[i]];

    if (v !== undefined &&
        v !== null &&
        v !== "") {
      return v;
    }
  }

  return "";
}

function hgError(e) {
  return hgStr(e && e.message ? e.message : e);
}

function hgHeaders(json) {
  var h = {
    "User-Agent": HG_UA,
    "Referer": HG_BASE + "/",
    "Accept": json
      ? "application/json"
      : "text/html,application/xhtml+xml"
  };

  if (json) {
    h["Content-Type"] = "application/json";
  }

  return h;
}

async function hgFetch(url, options) {
  var response = await fetch(
    url,
    options || {
      method: "GET",
      headers: hgHeaders(false),
      credentials: "include"
    }
  );

  if (!response.ok) {
    throw Error("HTTP " + response.status);
  }

  return response;
}

function hgParseRouter(html) {
  var pos = html.indexOf("_ROUTER_DATA");

  if (pos < 0) {
    throw Error("没有 _ROUTER_DATA");
  }

  var start = html.indexOf("{", pos);

  if (start < 0) {
    throw Error("没有路由 JSON");
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
  var r = await hgFetch(url);
  return hgParseRouter(await r.text());
}

async function hgPost(path, body) {
  var r = await hgFetch(
    HG_BASE + path,
    {
      method: "POST",
      headers: hgHeaders(true),
      credentials: "include",
      body: JSON.stringify(body)
    }
  );

  return await r.json();
}

function hgFind(obj, test, depth) {
  if (!obj ||
      typeof obj !== "object" ||
      depth > 8) {
    return null;
  }

  if (test(obj)) return obj;

  var keys = Object.keys(obj);

  for (var i = 0; i < keys.length; i++) {
    var key = keys[i];

    if (/^(req|request|headers)$/.test(key)) {
      continue;
    }

    var found = hgFind(
      obj[key],
      test,
      depth + 1
    );

    if (found) return found;
  }

  return null;
}

function hgId(item) {
  if (typeof item === "string" ||
      typeof item === "number") {
    return hgStr(item);
  }

  return hgStr(hgPick(item, [
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
    "backup_url_2",
    "play_url",
    "playUrl",
    "video_url",
    "videoUrl",
    "url"
  ];

  for (var i = 0; i < fields.length; i++) {
    var v = info[fields[i]];

    if (typeof v === "string") {
      var u = hgURL(v);
      if (u) return u;
    }

    if (v && typeof v === "object") {
      var nested = hgURL(
        v.main_url || v.url
      );

      if (nested) return nested;
    }
  }

  return "";
}

/*
 * 首页
 */

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
        function (o) {
          return Array.isArray(o.recommendList) &&
            o.recommendList.length > 0;
        },
        0
      );

      if (!node) continue;

      var cards = [];

      for (var i = 0;
           i < node.recommendList.length;
           i++) {

        var entry = node.recommendList[i];

        var v =
          entry.video_data ||
          entry.videoData ||
          entry;

        var id = hgStr(hgPick(v, [
          "series_id",
          "seriesId",
          "book_id"
        ]));

        if (!id) continue;

        var title = hgStr(hgPick(v, [
          "series_name",
          "seriesName",
          "title",
          "name"
        ]));

        var cover = hgStr(hgPick(v, [
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
          description: hgStr(hgPick(v, [
            "series_intro",
            "description",
            "intro"
          ]))
        };

        HG_CACHE[id] = card;
        cards.push(card);
      }

      if (cards.length) {
        return {
          list: cards,
          items: cards,
          videos: cards
        };
      }

    } catch (e) {
      errors.push(hgError(e));
    }
  }

  var error = {
    id: "diag032",
    title: "v0.3.2 首页失败",
    name: "v0.3.2 首页失败",
    cover: "",
    description: errors.join("；")
  };

  return {
    list: [error],
    items: [error],
    videos: [error]
  };
};

/*
 * 详情和选集
 *
 * 每集仅返回集数，不设置封面。
 */

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

  var d = node.seriesDetail;
  var cached = HG_CACHE[seriesId] || {};

  var title = hgStr(hgPick(d, [
    "series_name",
    "series_title",
    "title"
  ]) || cached.title);

  var cover = hgStr(hgPick(d, [
    "series_cover",
    "cover"
  ]) || cached.cover);

  var desc = hgStr(hgPick(d, [
    "series_intro",
    "description",
    "intro"
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
      ? hgStr(hgPick(entry, [
          "vid",
          "video_id",
          "videoId",
          "id"
        ]))
      : hgStr(entry);

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

/*
 * 网页播放页
 *
 * 第一次出现 VID 不匹配时，
 * 再请求一次相同的正确剧集地址。
 *
 * 不允许返回错误剧集。
 */

async function hgWebOnce(seriesId, vid) {
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

  if (!page || page.isSuccess === false) {
    throw Error("播放页没有有效媒体数据");
  }

  var pageVid = hgStr(page.vid);
  var pageSeries = hgStr(page.series_id);

  if (
    (pageVid && pageVid !== vid) ||
    (pageSeries && pageSeries !== seriesId)
  ) {
    throw Error("VID_MISMATCH");
  }

  var direct = hgMedia(
    page.video_player_info
  );

  if (direct) {
    return direct;
  }

  var seo = page.publicVideoSeo;

  if (
    seo &&
    seo.available === true &&
    hgStr(seo.seriesId) === seriesId &&
    hgStr(seo.itemId) === vid
  ) {
    return HG_BASE +
      "/video/public/" +
      encodeURIComponent(vid) +
      "/360p.mp4";
  }

  throw Error("没有公开媒体地址");
}

async function hgWeb(seriesId, vid) {
  try {
    return await hgWebOnce(seriesId, vid);
  } catch (e) {
    if (hgError(e) !== "VID_MISMATCH") {
      throw e;
    }
  }

  /*
   * 参考 AngelLive 的网页会话重试。
   * 是否保留 Cookie 取决于 Coconut 宿主。
   */

  try {
    return await hgWebOnce(seriesId, vid);
  } catch (e) {
    if (hgError(e) === "VID_MISMATCH") {
      throw Error(
        "重试后 VID 仍不匹配，可能被重定向至预览集"
      );
    }

    throw e;
  }
}

/*
 * MP4 兜底接口
 */

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

/*
 * play-info 接口
 *
 * 仅交付没有明确加密要求的资源。
 */

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

      var accessKey = hgStr(
        info.player_access_key
      ).trim();

      if (
        info.encrypted === true ||
        info.is_encrypted === true ||
        info.drm ||
        info.decryption ||
        /^[0-9a-fA-F]{32}$/.test(accessKey)
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
        definition + ":" + hgError(e)
      );

      if (/HTTP 403/.test(hgError(e))) {
        break;
      }
    }
  }

  throw Error(errors.join("；"));
}

/*
 * Coconut 播放函数
 */

var extractStreamUrl = async function (input) {
  var vid = hgId(input);

  if (!/^\d+$/.test(vid)) {
    throw Error(
      "v0.3.2：无效 VID"
    );
  }

  var seriesId = HG_SERIES[vid] || "";
  var errors = [];

  /*
   * 线路 1：官网公开播放页
   */

  if (seriesId) {
    try {
      var webURL = await hgWeb(
        seriesId,
        vid
      );

      if (webURL) {
        return {
          url: webURL
        };
      }
    } catch (e) {
      errors.push(
        "网页：" + hgError(e)
      );
    }
  } else {
    errors.push("没有 series_id");
  }

  /*
   * 线路 2：官网 MP4 兜底
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
      "MP4兜底：" + hgError(e)
    );
  }

  /*
   * 线路 3：官网 play-info
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
        "play-info：" + hgError(e)
      );
    }
  }

  throw Error(
    "v0.3.2 播放失败；" +
    errors.join(" | ").slice(0, 650)
  );
};
