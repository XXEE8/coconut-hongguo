/*
 * Coconut 红果短剧 v0.2.9
 * 基于 AngelLive hongguo v1.1.0 的公开网页接口
 *
 * 功能：
 * 1. 真实首页
 * 2. 真实详情和选集
 * 3. 官网未加密 MP4 兜底接口
 * 4. 官网公开播放页
 * 5. 官网 play-info 接口
 *
 * 不需要登录，不使用测试视频。
 */

var HG_BASE = "https://hongguoduanju.com";
var HG_SERIES = {};
var HG_VIDEO = {};

function hs(v) {
  return v == null ? "" : String(v);
}

function hp(obj, keys) {
  if (!obj || typeof obj !== "object") return "";
  for (var i = 0; i < keys.length; i++) {
    var value = obj[keys[i]];
    if (value !== undefined &&
        value !== null &&
        value !== "") {
      return value;
    }
  }
  return "";
}

function hError(e) {
  return hs(e && e.message ? e.message : e);
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
        return JSON.parse(html.slice(start, i + 1));
      }
    }
  }

  throw Error("JSON 解析不完整");
}

async function hRequest(url, options) {
  var r = await fetch(url, options || {});

  if (!r.ok) {
    throw Error("HTTP " + r.status);
  }

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
      "Accept": "application/json"
    },
    body: JSON.stringify(body)
  });

  return await r.json();
}

function hFind(obj, predicate, depth) {
  if (!obj || typeof obj !== "object" || depth > 7) {
    return null;
  }

  if (predicate(obj)) return obj;

  var keys = Object.keys(obj);

  for (var i = 0; i < keys.length; i++) {
    var k = keys[i];

    if (/^(req|request|headers)$/.test(k)) {
      continue;
    }

    var found = hFind(
      obj[k],
      predicate,
      depth + 1
    );

    if (found) return found;
  }

  return null;
}

function hCard(item, i) {
  var v = item.video_data || item.videoData || item;

  var id = hs(hp(v, [
    "series_id", "seriesId",
    "book_id", "bookId"
  ]));

  var title = hs(hp(v, [
    "series_name", "seriesName",
    "title", "name"
  ]));

  var cover = hs(hp(v, [
    "series_cover", "seriesCover",
    "cover", "cover_url"
  ]));

  if (!id) return null;

  return {
    id: id,
    title: title || "未提供剧名",
    name: title || "未提供剧名",
    cover: cover,
    description: hs(hp(v, [
      "series_intro", "description",
      "intro", "abstract"
    ]))
  };
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

      var found = hFind(
        router.loaderData || {},
        function (v) {
          return Array.isArray(v.recommendList) &&
            v.recommendList.length > 0;
        },
        0
      );

      if (!found) continue;

      var cards = [];

      for (var i = 0; i < found.recommendList.length; i++) {
        var card = hCard(found.recommendList[i], i);
        if (card) cards.push(card);
      }

      if (cards.length) {
        return {
          list: cards,
          items: cards,
          videos: cards
        };
      }
    } catch (e) {
      errors.push(hError(e));
    }
  }

  var err = {
    id: "diag029",
    title: "v0.2.9 首页失败",
    name: "v0.2.9 首页失败",
    cover: "",
    description: errors.join("; ")
  };

  return {
    list: [err],
    items: [err],
    videos: [err]
  };
};

/* 详情 */

function hItemId(item) {
  if (typeof item === "string" ||
      typeof item === "number") {
    return hs(item);
  }

  return hs(hp(item, [
    "id", "series_id", "seriesId",
    "video_id", "videoId", "vid"
  ]));
}

var extractDetails = async function (item) {
  var id = hItemId(item);

  if (!/^\d+$/.test(id)) {
    throw Error("无效的 series_id");
  }

  var router = await hPage(
    HG_BASE + "/detail?series_id=" +
    encodeURIComponent(id)
  );

  var found = hFind(
    router.loaderData || {},
    function (v) {
      return !!(
        v.seriesDetail &&
        typeof v.seriesDetail === "object"
      );
    },
    0
  );

  if (!found) {
    throw Error("没有找到 seriesDetail");
  }

  var d = found.seriesDetail;

  var title = hs(hp(d, [
    "series_name", "series_title", "title"
  ]));

  var cover = hs(hp(d, [
    "series_cover", "cover"
  ]));

  var desc = hs(hp(d, [
    "series_intro", "description", "intro"
  ]));

  var raw = d.vid_list || [];

  if (!Array.isArray(raw)) {
    raw = [];
  }

  var episodes = [];

  for (var i = 0; i < raw.length; i++) {
    var entry = raw[i];

    var vid = typeof entry === "object"
      ? hs(hp(entry, ["vid", "video_id", "id"]))
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

  var count = Number(
    d.episode_cnt || episodes.length
  );

  if (!episodes.length) {
    throw Error("详情中没有剧集 VID");
  }

  if (d.accessible_episode_cnt != null) {
    desc += "\n网页可访问集数：" +
      d.accessible_episode_cnt;
  }

  desc += "\n总集数：" + count;
  desc += "\n已解析选集：" + episodes.length;
  desc += "\n播放线路：官网公开流 / MP4 兜底";

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

/* 播放资源识别 */

function hUrl(value) {
  if (typeof value !== "string") return "";

  var s = value.trim();

  if (s.indexOf("//") === 0) {
    s = "https:" + s;
  }

  return /^https?:\/\/\S+$/i.test(s) ? s : "";
}

function hMedia(obj, depth) {
  if (!obj || depth > 6) return "";

  if (typeof obj === "string") {
    return hUrl(obj);
  }

  if (typeof obj !== "object") {
    return "";
  }

  var names = [
    "main_url", "backup_url",
    "play_url", "playUrl",
    "video_url", "videoUrl",
    "url", "src"
  ];

  for (var i = 0; i < names.length; i++) {
    var v = obj[names[i]];

    if (v !== undefined) {
      var u = hMedia(v, depth + 1);
      if (u) return u;
    }
  }

  return "";
}

/*
 * 线路 1
 * AngelLive 1.1.0 使用的官网公开 MP4 兜底
 */

async function hFallback(vid) {
  var data = await hPost(
    "/api/video/protected/fallback-play-info",
    {
      item_id: vid
    }
  );

  var url = hUrl(data && data.main_url);

  if (!url) {
    throw Error("兜底接口没有返回 main_url");
  }

  return url;
}

/*
 * 线路 2
 * 官网公开播放页面
 */

async function hWebPlayer(seriesId, vid) {
  var router = await hPage(
    HG_BASE + "/player/" +
    encodeURIComponent(seriesId) + "/" +
    encodeURIComponent(vid)
  );

  var page = hFind(
    router.loaderData || {},
    function (v) {
      return !!(
        v.video_player_info ||
        v.publicVideoSeo
      );
    },
    0
  );

  if (!page) {
    throw Error("播放页没有媒体数据");
  }

  if (
    page.vid &&
    hs(page.vid) !== vid
  ) {
    throw Error("播放页返回了其他 VID");
  }

  if (
    page.series_id &&
    hs(page.series_id) !== seriesId
  ) {
    throw Error("播放页返回了其他剧集");
  }

  var url = hMedia(page.video_player_info, 0);

  if (url) return url;

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

  throw Error("播放页没有公开直链");
}

/*
 * 线路 3
 * 官网 play-info
 *
 * 仅交付无需额外解密的资源。
 */

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
        throw Error("该清晰度需要额外解密");
      }

      var url = hMedia(info, 0);

      if (url) return url;

      throw Error("没有媒体地址");

    } catch (e) {
      errors.push(
        definitions[i] + ":" + hError(e)
      );
    }
  }

  throw Error(errors.join("; "));
}

/*
 * Coconut 播放函数
 */

var extractStreamUrl = async function (input) {
  var vid = hItemId(input);

  if (!/^\d+$/.test(vid)) {
    throw Error(
      "v0.2.9：未收到有效视频 VID"
    );
  }

  var errors = [];

  /* 优先尝试官网未加密兜底流 */
  try {
    var url1 = await hFallback(vid);

    if (url1) {
      return { url: url1 };
    }
  } catch (e) {
    errors.push("兜底：" + hError(e));
  }

  var seriesId = HG_SERIES[vid] || "";

  /* 只有拿到剧集 ID 才能查询其他两条线路 */
  if (seriesId) {
    try {
      var url2 = await hWebPlayer(seriesId, vid);

      if (url2) {
        return { url: url2 };
      }
    } catch (e) {
      errors.push("网页：" + hError(e));
    }

    try {
      var url3 = await hProtected(seriesId, vid);

      if (url3) {
        return { url: url3 };
      }
    } catch (e) {
      errors.push("接口：" + hError(e));
    }
  } else {
    errors.push(
      "未获得 series_id，无法测试播放页和 play-info"
    );
  }

  throw Error(
    "v0.2.9 播放失败；" +
    errors.join(" | ").slice(0, 650)
  );
};
