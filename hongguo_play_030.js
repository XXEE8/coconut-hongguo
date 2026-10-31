/*
 * Coconut 红果短剧 v0.3.0
 *
 * 首页 + 真实详情 + 选集
 * 官网公开播放页
 * 受保护集 MP4 兜底
 * 播放接口错误诊断
 *
 * 无需登录
 */

var HG_BASE = "https://hongguoduanju.com";
var HG_SERIES = {};
var HG_CACHE = {};

function hs(v) {
  return v == null ? "" : String(v);
}

function hp(o, names) {
  if (!o || typeof o !== "object") return "";
  for (var i = 0; i < names.length; i++) {
    var v = o[names[i]];
    if (v !== undefined && v !== null && v !== "") {
      return v;
    }
  }
  return "";
}

function he(e) {
  return hs(e && e.message ? e.message : e);
}

function hParse(html) {
  var pos = html.indexOf("_ROUTER_DATA");
  if (pos < 0) throw Error("没有 _ROUTER_DATA");

  var start = html.indexOf("{", pos);
  if (start < 0) throw Error("没有 JSON");

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

  throw Error("JSON 不完整");
}

async function hRequest(url, options) {
  var r = await fetch(url, options || {});
  if (!r.ok) throw Error("HTTP " + r.status);
  return r;
}

async function hPage(url) {
  var r = await hRequest(url);
  return hParse(await r.text());
}

async function hPost(path, body) {
  var r = await hRequest(HG_BASE + path, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Accept": "application/json",
      "Referer": HG_BASE + "/"
    },
    body: JSON.stringify(body)
  });

  return await r.json();
}

function hFind(obj, test, depth) {
  if (!obj || typeof obj !== "object" || depth > 7) {
    return null;
  }

  if (test(obj)) return obj;

  var keys = Object.keys(obj);

  for (var i = 0; i < keys.length; i++) {
    var k = keys[i];

    if (/^(req|request|headers)$/.test(k)) continue;

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
    "id", "series_id", "seriesId",
    "vid", "video_id", "videoId"
  ]));
}

function hMediaURL(value) {
  if (typeof value !== "string") return "";

  var s = value.trim();
  if (s.indexOf("//") === 0) s = "https:" + s;

  return /^https?:\/\/\S+$/i.test(s) ? s : "";
}

function hMedia(info) {
  if (!info) return "";

  if (typeof info === "string") {
    return hMediaURL(info);
  }

  var fields = [
    "main_url", "backup_url",
    "backup_url_1", "backup_url_2",
    "play_url", "video_url", "url"
  ];

  for (var i = 0; i < fields.length; i++) {
    var v = info[fields[i]];

    if (typeof v === "string") {
      var url = hMediaURL(v);
      if (url) return url;
    }

    if (v && typeof v === "object") {
      var nested = hMediaURL(v.url || v.main_url);
      if (nested) return nested;
    }
  }

  return "";
}

/* 首页 */

var home = async function () {
  var urls = [
    HG_BASE + "/category/real-drama?page=1",
    HG_BASE + "/category?tab=1&sort_type=1"
  ];

  var errors = [];

  for (var n = 0; n < urls.length; n++) {
    try {
      var router = await hPage(urls[n]);

      var node = hFind(
        router.loaderData || {},
        function (o) {
          return Array.isArray(o.recommendList) &&
            o.recommendList.length > 0;
        },
        0
      );

      if (!node) continue;

      var cards = [];

      for (var i = 0; i < node.recommendList.length; i++) {
        var entry = node.recommendList[i];
        var v = entry.video_data || entry.videoData || entry;

        var id = hs(hp(v, [
          "series_id", "seriesId", "book_id"
        ]));

        if (!id) continue;

        var title = hs(hp(v, [
          "series_name", "seriesName", "title", "name"
        ]));

        var cover = hs(hp(v, [
          "series_cover", "seriesCover",
          "cover", "cover_url"
        ]));

        var card = {
          id: id,
          title: title || "未命名短剧",
          name: title || "未命名短剧",
          cover: cover,
          description: hs(hp(v, [
            "series_intro", "description", "intro"
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
      errors.push(he(e));
    }
  }

  var error = {
    id: "diag030",
    title: "v0.3.0 首页读取失败",
    name: "v0.3.0 首页读取失败",
    cover: "",
    description: errors.join("；")
  };

  return {
    list: [error],
    items: [error],
    videos: [error]
  };
};

/* 详情和选集 */

var extractDetails = async function (item) {
  var id = hId(item);

  if (!/^\d+$/.test(id)) {
    throw Error("无效 series_id");
  }

  var router = await hPage(
    HG_BASE + "/detail?series_id=" +
    encodeURIComponent(id)
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

  if (!node) throw Error("找不到 seriesDetail");

  var d = node.seriesDetail;
  var cached = HG_CACHE[id] || {};

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

    HG_SERIES[vid] = id;

    episodes.push({
      id: vid,
      title: "第" + (i + 1) + "集",
      name: "第" + (i + 1) + "集",
      episode: i + 1,
      index: i + 1
    });
  }

  if (!episodes.length) {
    throw Error("没有解析到剧集 VID");
  }

  var count = Number(
    d.episode_cnt || episodes.length
  );

  if (!Number.isFinite(count)) {
    count = episodes.length;
  }

  if (d.accessible_episode_cnt != null) {
    desc += "\n网页公开集数：" +
      d.accessible_episode_cnt;
  }

  desc += "\n总集数：" + count;
  desc += "\n已解析选集：" + episodes.length;

  return {
    id: id,
    title: title,
    name: title,
    cover: cover,
    description: desc,
    episodeCount: count,
    episodes: episodes
  };
};

/* 线路 A：网页播放页 */

async function hWeb(seriesId, vid, retry) {
  var router = await hPage(
    HG_BASE + "/player/" +
    encodeURIComponent(seriesId) + "/" +
    encodeURIComponent(vid)
  );

  var page = hFind(
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
    throw Error("播放页没有有效媒体信息");
  }

  var pageVid = hs(page.vid);
  var pageSeries = hs(page.series_id);

  var mismatch =
    (pageVid && pageVid !== vid) ||
    (pageSeries && pageSeries !== seriesId);

  if (mismatch) {
    if (retry) {
      return await hWeb(seriesId, vid, false);
    }

    throw Error("网页返回的不是当前剧集");
  }

  var direct = hMedia(page.video_player_info);

  if (direct) return direct;

  var seo = page.publicVideoSeo;

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

  throw Error("该集没有公开播放地址");
}

/* 线路 B：官网未加密 MP4 兜底 */

async function hFallback(vid) {
  var data = await hPost(
    "/api/video/protected/fallback-play-info",
    { item_id: vid }
  );

  var url = hMediaURL(
    data && data.main_url
  );

  if (!url) {
    throw Error("兜底接口未返回 main_url");
  }

  return url;
}

/* 线路 C：官网受保护集 play-info */

async function hProtected(seriesId, vid) {
  var definitions = ["720p", "480p", "360p"];
  var errors = [];

  for (var i = 0; i < definitions.length; i++) {
    var definition = definitions[i];

    for (var attempt = 0; attempt < 2; attempt++) {
      try {
        var data = await hPost(
          "/api/video/protected/play-info",
          {
            series_id: seriesId,
            item_id: vid,
            definition: definition
          }
        );

        var info = data && data.play_info;

        if (!info) {
          throw Error("缺少 play_info");
        }

        var url = hMedia(info);

        if (!url) {
          throw Error("缺少播放地址");
        }

        var accessKey = hs(
          info.player_access_key
        ).trim();

        if (
          info.encrypted === true ||
          info.is_encrypted === true ||
          info.drm ||
          info.decryption ||
          accessKey
        ) {
          throw Error(
            "返回资源包含加密信息，Coconut 尚未验证支持解密"
          );
        }

        return url;

      } catch (e) {
        var message = he(e);
        errors.push(
          definition + ":" + message
        );

        if (/HTTP 403|HTTP 404|加密/.test(message)) {
          break;
        }
      }
    }
  }

  throw Error(errors.join("；").slice(0, 300));
}

/* 解析播放地址 */

var extractStreamUrl = async function (input) {
  var vid = hId(input);

  if (!/^\d+$/.test(vid)) {
    throw Error(
      "v0.3.0：未收到有效剧集 VID"
    );
  }

  var seriesId = HG_SERIES[vid] || "";
  var errors = [];

  /*
   * 优先读取网页公开流。
   * 前三集已经证明这条路线可用。
   */
  if (seriesId) {
    try {
      var webURL = await hWeb(
        seriesId,
        vid,
        true
      );

      if (webURL) {
        return { url: webURL };
      }
    } catch (e) {
      errors.push("网页：" + he(e));
    }
  } else {
    errors.push("没有 series_id");
  }

  /*
   * 后续剧集：
   * 优先官网未加密 MP4 兜底。
   */
  try {
    var fallbackURL = await hFallback(vid);

    if (fallbackURL) {
      return { url: fallbackURL };
    }
  } catch (e) {
    errors.push("MP4兜底：" + he(e));
  }

  /*
   * 最后尝试 play-info。
   * 不把明确标记为加密的资源冒充普通视频。
   */
  if (seriesId) {
    try {
      var protectedURL = await hProtected(
        seriesId,
        vid
      );

      if (protectedURL) {
        return { url: protectedURL };
      }
    } catch (e) {
      errors.push("play-info：" + he(e));
    }
  }

  throw Error(
    "v0.3.0 播放诊断失败；" +
    errors.join(" | ").slice(0, 650)
  );
};
