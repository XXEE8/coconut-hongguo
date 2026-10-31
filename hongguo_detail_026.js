
/*
 * Coconut Hongguo v0.2.6
 * 真实目录 + 真实详情 + 真实选集
 * 不提供测试视频或虚假集数
 */

var HG_BASE = "https://hongguoduanju.com";
var HG_CACHE = {};

function hgStr(v) {
  return v === null || v === undefined
    ? ""
    : String(v);
}

function hgParse(html) {
  var pos = html.indexOf("_ROUTER_DATA");
  if (pos < 0) throw Error("找不到 _ROUTER_DATA");

  var start = html.indexOf("{", pos);
  if (start < 0) throw Error("找不到 JSON 起点");

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

async function hgGet(url) {
  var response = await fetch(url);

  if (!response.ok) {
    throw Error("HTTP " + response.status);
  }

  return hgParse(await response.text());
}

function hgFindList(obj, depth) {
  if (!obj || typeof obj !== "object" ||
      depth > 6) return null;

  if (Array.isArray(obj.recommendList) &&
      obj.recommendList.length) {
    return obj.recommendList;
  }

  if (obj.categoryData) {
    var nested = hgFindList(
      obj.categoryData, depth + 1
    );
    if (nested) return nested;
  }

  var keys = Object.keys(obj);

  for (var i = 0; i < keys.length; i++) {
    var key = keys[i];

    if (
      key === "req" ||
      key === "request" ||
      key === "headers" ||
      key === "query" ||
      key === "apiQuery"
    ) continue;

    var found = hgFindList(
      obj[key], depth + 1
    );
    if (found) return found;
  }

  return null;
}

function hgCard(item, index) {
  var v = item.video_data ||
          item.videoData ||
          item;

  var id = hgStr(
    v.series_id ||
    v.seriesId ||
    v.book_id ||
    v.bookId ||
    item.series_id ||
    ""
  );

  var title = hgStr(
    v.series_name ||
    v.seriesName ||
    v.book_name ||
    v.title ||
    v.name ||
    item.title ||
    ""
  );

  var cover = hgStr(
    v.series_cover ||
    v.seriesCover ||
    v.cover ||
    v.cover_url ||
    v.book_cover ||
    item.cover ||
    ""
  );

  var desc = hgStr(
    v.description ||
    v.intro ||
    v.abstract ||
    item.description ||
    ""
  );

  if (!id && !title) return null;

  var card = {
    id: id || "unknown_" + index,
    title: title || "未提供剧名",
    name: title || "未提供剧名",
    cover: cover,
    description: desc
  };

  HG_CACHE[card.id] = card;
  return card;
}

var home = async function () {
  var urls = [
    HG_BASE + "/category/real-drama?page=1",
    HG_BASE + "/category?tab=1&sort_type=1"
  ];

  var reports = [];

  for (var n = 0; n < urls.length; n++) {
    try {
      var router = await hgGet(urls[n]);
      var loader = router.loaderData || {};
      var list = hgFindList(loader, 0);

      if (!list || !list.length) {
        reports.push("线路" + (n + 1) + "无列表");
        continue;
      }

      var cards = [];

      for (var i = 0; i < list.length; i++) {
        var card = hgCard(list[i], i);
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
      reports.push(
        "线路" + (n + 1) + ": " +
        hgStr(e.message || e)
      );
    }
  }

  var errorCard = {
    id: "diag026",
    title: "v0.2.6 目录读取失败",
    name: "v0.2.6 目录读取失败",
    cover: "",
    description: reports.join("；")
  };

  return {
    list: [errorCard],
    items: [errorCard],
    videos: [errorCard]
  };
};

function hgFindDetail(obj, depth) {
  if (!obj || typeof obj !== "object" ||
      depth > 6) return null;

  if (obj.seriesDetail &&
      typeof obj.seriesDetail === "object") {
    return obj.seriesDetail;
  }

  if (obj.vid_list &&
      (obj.series_id || obj.series_name)) {
    return obj;
  }

  var keys = Object.keys(obj);

  for (var i = 0; i < keys.length; i++) {
    var key = keys[i];

    if (
      key === "req" ||
      key === "request" ||
      key === "headers"
    ) continue;

    var found = hgFindDetail(
      obj[key], depth + 1
    );

    if (found) return found;
  }

  return null;
}

function hgGetId(item) {
  if (typeof item === "string" ||
      typeof item === "number") {
    return hgStr(item);
  }

  if (!item) return "";

  return hgStr(
    item.id ||
    item.series_id ||
    item.seriesId ||
    item.book_id ||
    item.bookId ||
    item.videoId ||
    ""
  );
}

function hgMakeEpisodes(detail) {
  var raw =
    detail.vid_list ||
    detail.vidList ||
    detail.episode_list ||
    detail.episodeList ||
    [];

  if (!Array.isArray(raw)) {
    if (raw && typeof raw === "object") {
      raw = Object.values(raw);
    } else {
      raw = [];
    }
  }

  var episodes = [];

  for (var i = 0; i < raw.length; i++) {
    var entry = raw[i];

    var vid = "";
    var label = "第" + (i + 1) + "集";

    if (
      typeof entry === "string" ||
      typeof entry === "number"
    ) {
      vid = hgStr(entry);
    } else if (entry &&
               typeof entry === "object") {
      vid = hgStr(
        entry.vid ||
        entry.video_id ||
        entry.videoId ||
        entry.id ||
        ""
      );

      label = hgStr(
        entry.title ||
        entry.name ||
        label
      );
    }

    if (!vid) continue;

    episodes.push({
      id: vid,
      title: label,
      name: label,
      episode: i + 1,
      index: i + 1
    });
  }

  return episodes;
}

var extractDetails = async function (item) {
  var id = hgGetId(item);

  if (!id || id.indexOf("unknown_") === 0) {
    throw Error("作品没有有效的 series_id");
  }

  var url = HG_BASE +
    "/detail?series_id=" +
    encodeURIComponent(id);

  var router = await hgGet(url);
  var loader = router.loaderData || {};

  var detail = hgFindDetail(
    loader.detail_page || loader, 0
  );

  if (!detail) {
    throw Error(
      "详情页没有找到 seriesDetail；路由：" +
      Object.keys(loader).join(",")
    );
  }

  var cached = HG_CACHE[id] || {};

  var title = hgStr(
    detail.series_name ||
    detail.seriesName ||
    detail.title ||
    cached.title ||
    ""
  );

  var cover = hgStr(
    detail.series_cover ||
    detail.seriesCover ||
    detail.cover ||
    cached.cover ||
    ""
  );

  var desc = hgStr(
    detail.description ||
    detail.intro ||
    detail.abstract ||
    cached.description ||
    ""
  );

  var episodes = hgMakeEpisodes(detail);

  var count = Number(
    detail.episode_cnt ||
    detail.episode_count ||
    detail.episodeCount ||
    detail.total_episode ||
    episodes.length
  );

  if (!Number.isFinite(count) || count < 0) {
    count = episodes.length;
  }

  var accessible = detail.accessible_episode_cnt;

  if (accessible !== undefined &&
      accessible !== null) {
    desc += "\n可访问集数：" + accessible;
  }

  desc += "\n总集数：" + count;
  desc += "\n已解析选集：" + episodes.length;

  if (!episodes.length) {
    throw Error(
      "已获取《" + title +
      "》详情，但未解析到 vid_list"
    );
  }

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

var extractStreamUrl = async function () {
  // v0.2.6 暂不处理视频播放。
  // 不使用测试视频冒充真实剧集。
  return {
    url: ""
  };
};
