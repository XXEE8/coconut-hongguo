/*
 * Coconut Hongguo v0.2.8
 * 真实目录 + 详情 + 选集 + 公开播放资源检测
 */

var HG_BASE = "https://hongguoduanju.com";
var HG_CACHE = {};
var HG_VIDEO = {};
var HG_DETAIL = {};

function hs(v) {
  return v == null ? "" : String(v);
}

function pick(o, keys) {
  if (!o || typeof o !== "object") return "";
  for (var i = 0; i < keys.length; i++) {
    if (
      o[keys[i]] !== undefined &&
      o[keys[i]] !== null &&
      o[keys[i]] !== ""
    ) {
      return o[keys[i]];
    }
  }
  return "";
}

function parseRouter(html) {
  var pos = html.indexOf("_ROUTER_DATA");
  if (pos < 0) throw Error("未找到 _ROUTER_DATA");

  var start = html.indexOf("{", pos);
  if (start < 0) throw Error("未找到路由 JSON");

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

async function hgGet(url) {
  var r = await fetch(url);
  if (!r.ok) throw Error("HTTP " + r.status);
  return parseRouter(await r.text());
}

function findList(obj, depth) {
  if (!obj || typeof obj !== "object" || depth > 7) {
    return null;
  }

  if (
    Array.isArray(obj.recommendList) &&
    obj.recommendList.length
  ) {
    return obj.recommendList;
  }

  var keys = Object.keys(obj);

  for (var i = 0; i < keys.length; i++) {
    if (
      /^(req|request|headers|query|apiQuery)$/.test(keys[i])
    ) {
      continue;
    }

    var result = findList(obj[keys[i]], depth + 1);
    if (result) return result;
  }

  return null;
}

function makeCard(item, i) {
  var v = item.video_data || item.videoData || item;

  var id = hs(
    pick(v, ["series_id", "seriesId", "book_id", "bookId"]) ||
    item.series_id
  );

  var title = hs(
    pick(v, [
      "series_name", "seriesName", "book_name",
      "title", "name"
    ]) || item.title
  );

  var cover = hs(
    pick(v, [
      "series_cover", "seriesCover", "cover",
      "cover_url", "book_cover"
    ]) || item.cover
  );

  var desc = hs(
    pick(v, ["description", "intro", "abstract"]) ||
    item.description
  );

  if (!id && !title) return null;

  var card = {
    id: id || "unknown_" + i,
    title: title || "未提供剧名",
    name: title || "未提供剧名",
    cover: cover,
    description: desc
  };

  HG_CACHE[card.id] = card;
  return card;
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
      var router = await hgGet(urls[n]);
      var list = findList(router.loaderData || {}, 0);

      if (!list || !list.length) {
        errors.push("线路" + (n + 1) + "无列表");
        continue;
      }

      var cards = [];

      for (var i = 0; i < list.length; i++) {
        var card = makeCard(list[i], i);
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
      errors.push(
        "线路" + (n + 1) + ": " + hs(e.message || e)
      );
    }
  }

  var error = {
    id: "diag028",
    title: "v0.2.8 目录失败",
    name: "v0.2.8 目录失败",
    cover: "",
    description: errors.join("; ")
  };

  return {
    list: [error],
    items: [error],
    videos: [error]
  };
};

/* 详情解析 */

function findDetail(obj, depth) {
  if (!obj || typeof obj !== "object" || depth > 7) {
    return null;
  }

  if (
    obj.seriesDetail &&
    typeof obj.seriesDetail === "object"
  ) {
    return obj.seriesDetail;
  }

  if (
    obj.vid_list &&
    (obj.series_id || obj.series_name)
  ) {
    return obj;
  }

  var keys = Object.keys(obj);

  for (var i = 0; i < keys.length; i++) {
    if (/^(req|request|headers)$/.test(keys[i])) {
      continue;
    }

    var found = findDetail(obj[keys[i]], depth + 1);
    if (found) return found;
  }

  return null;
}

function itemId(item) {
  if (
    typeof item === "string" ||
    typeof item === "number"
  ) {
    return hs(item);
  }

  return hs(
    pick(item, [
      "id", "series_id", "seriesId",
      "book_id", "bookId", "videoId"
    ])
  );
}

function directUrl(s) {
  if (typeof s !== "string") return "";

  var url = s.trim();

  if (
    /^https?:\/\/[^\s]+\.(m3u8|mp4)(?:[?#][^\s]*)?$/i
      .test(url)
  ) {
    return url;
  }

  return "";
}

function publicUrl(obj, depth, seen) {
  if (depth > 6 || obj == null) return "";

  if (typeof obj === "string") {
    return directUrl(obj);
  }

  if (typeof obj !== "object") return "";

  if (seen.indexOf(obj) >= 0) return "";
  seen.push(obj);

  var keys = [
    "play_url", "playUrl", "video_url",
    "videoUrl", "main_url", "url",
    "src", "hls", "mp4"
  ];

  for (var i = 0; i < keys.length; i++) {
    if (obj[keys[i]] !== undefined) {
      var u = publicUrl(
        obj[keys[i]],
        depth + 1,
        seen
      );
      if (u) return u;
    }
  }

  var all = Object.keys(obj);

  for (var j = 0; j < all.length && j < 120; j++) {
    var k = all[j];

    if (
      /token|cookie|sign|auth|secret|password|session|credential|drm|license|key/i
        .test(k)
    ) {
      continue;
    }

    var v = publicUrl(
      obj[k],
      depth + 1,
      seen
    );

    if (v) return v;
  }

  return "";
}

/* 真实选集 */

function episodeList(detail) {
  var raw = pick(detail, [
    "vid_list", "vidList",
    "episode_list", "episodeList"
  ]) || [];

  if (!Array.isArray(raw)) {
    raw = raw && typeof raw === "object"
      ? Object.values(raw)
      : [];
  }

  var result = [];

  for (var i = 0; i < raw.length; i++) {
    var entry = raw[i];
    var vid = "";
    var title = "第" + (i + 1) + "集";

    if (
      typeof entry === "string" ||
      typeof entry === "number"
    ) {
      vid = hs(entry);
    } else if (
      entry &&
      typeof entry === "object"
    ) {
      vid = hs(
        pick(entry, [
          "vid", "video_id",
          "videoId", "id"
        ])
      );

      title = hs(
        pick(entry, ["title", "name"]) || title
      );
    }

    if (!vid) continue;

    var url = publicUrl(entry, 0, []);

    if (url) {
      HG_VIDEO[vid] = url;
    }

    result.push({
      id: vid,
      title: title,
      name: title,
      episode: i + 1,
      index: i + 1
    });
  }

  return result;
}

var extractDetails = async function (item) {
  var id = itemId(item);

  if (!id || id.indexOf("unknown_") === 0) {
    throw Error("作品缺少有效 series_id");
  }

  var router = await hgGet(
    HG_BASE +
    "/detail?series_id=" +
    encodeURIComponent(id)
  );

  var loader = router.loaderData || {};

  var detail = findDetail(
    loader.detail_page || loader,
    0
  );

  if (!detail) {
    throw Error(
      "未找到 seriesDetail; 路由: " +
      Object.keys(loader).join(",")
    );
  }

  var cached = HG_CACHE[id] || {};

  var title = hs(
    pick(detail, [
      "series_name", "seriesName", "title"
    ]) || cached.title
  );

  var cover = hs(
    pick(detail, [
      "series_cover", "seriesCover", "cover"
    ]) || cached.cover
  );

  var desc = hs(
    pick(detail, [
      "description", "intro", "abstract"
    ]) || cached.description
  );

  var episodes = episodeList(detail);

  if (!episodes.length) {
    throw Error(
      "《" + title + "》未解析到 vid_list"
    );
  }

  var count = Number(
    pick(detail, [
      "episode_cnt", "episode_count",
      "episodeCount", "total_episode"
    ]) || episodes.length
  );

  if (!Number.isFinite(count) || count < 0) {
    count = episodes.length;
  }

  var accessible = detail.accessible_episode_cnt;

  if (
    accessible !== undefined &&
    accessible !== null
  ) {
    desc += "\n可访问集数：" + accessible;
  }

  desc += "\n总集数：" + count;
  desc += "\n已解析选集：" + episodes.length;

  var found = 0;

  for (var i = 0; i < episodes.length; i++) {
    if (HG_VIDEO[episodes[i].id]) {
      found++;
    }
  }

  desc += "\n公开直链：" + found + " 集";

  HG_DETAIL[id] = {
    title: title,
    episodes: episodes
  };

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

/* 播放地址 */

var extractStreamUrl = async function (input) {
  var vid = itemId(input);

  if (!vid) {
    throw Error(
      "v0.2.8：未收到有效 VID"
    );
  }

  var fromInput = publicUrl(input, 0, []);

  if (fromInput) {
    return { url: fromInput };
  }

  if (HG_VIDEO[vid]) {
    return { url: HG_VIDEO[vid] };
  }

  throw Error(
    "v0.2.8：已收到剧集 VID（长度 " +
    vid.length +
    "），但公开详情数据中未找到对应的 " +
    "MP4/M3U8 直链；视频可能需要官方授权播放接口。"
  );
};
