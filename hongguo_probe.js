
/*
 * Coconut Hongguo Probe v0.2.0
 * 真实目录 + 真实详情 + 真实分集
 * 播放接口仍使用公开测试视频
 */

var HG_BASE = "https://hongguoduanju.com";
var HG_CACHE = {};

function pick(obj, keys) {
  if (!obj || typeof obj !== "object") return "";
  for (var i = 0; i < keys.length; i++) {
    var v = obj[keys[i]];
    if (v !== undefined && v !== null && v !== "") {
      return v;
    }
  }
  return "";
}

function parseRouterData(html) {
  var pos = html.indexOf("_ROUTER_DATA");
  if (pos < 0) throw new Error("未找到网页数据");

  var start = html.indexOf("{", pos);
  if (start < 0) throw new Error("未找到 JSON");

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
    } else {
      if (c === '"') {
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
  }

  throw new Error("JSON 不完整");
}

async function getPage(url) {
  var response = await fetch(url);

  if (!response.ok) {
    throw new Error("HTTP " + response.status);
  }

  return parseRouterData(await response.text());
}

function getRoute(data, key) {
  var loader = data.loaderData || {};
  return loader[key] || Object.values(loader)[0] || {};
}

function makeItem(entry) {
  var v = entry.video_data || entry.videoData || entry;

  var id = String(pick(v, [
    "series_id", "seriesId", "id"
  ]));

  var title = String(pick(v, [
    "series_name", "series_title",
    "seriesName", "title", "name"
  ]) || pick(entry, ["name", "title"]) || "红果短剧");

  var cover = pick(v, [
    "series_cover", "cover",
    "cover_url", "coverUrl"
  ]);

  if (cover && typeof cover === "object") {
    cover = pick(cover, ["url", "uri"]);
  }

  var item = {
    id: id,
    title: title,
    name: title,
    cover: String(cover || ""),
    description: String(pick(v, [
      "series_intro", "description", "intro"
    ]) || ""),
    url: HG_BASE + "/detail?series_id=" +
         encodeURIComponent(id)
  };

  if (id) HG_CACHE[id] = item;

  return item;
}

function resolveId(input) {
  if (typeof input === "string" ||
      typeof input === "number") {
    var s = String(input);

    var match = s.match(/series_id=(\d+)/);
    if (match) return match[1];

    if (/^\d+$/.test(s)) return s;
  }

  if (input && typeof input === "object") {
    var id = pick(input, [
      "id", "series_id", "seriesId",
      "url", "link"
    ]);

    if (id) return resolveId(id);
  }

  return "";
}

// 首页：真实红果短剧
var home = async function () {
  var data = await getPage(
    HG_BASE + "/category?tab=1&sort_type=1"
  );

  var route = getRoute(data, "category_page");

  var list = route.recommendList ||
    (route.categoryData &&
     route.categoryData.recommendList) ||
    [];

  var items = list.map(makeItem).filter(function (x) {
    return !!x.id;
  });

  if (!items.length) {
    throw new Error("未找到红果短剧目录");
  }

  return {
    list: items,
    items: items,
    videos: items
  };
};

// 详情：真实剧名、简介、集数、分集ID
var extractDetails = async function (input) {
  var id = resolveId(input);

  // 如果 Coconut 没传 ID，使用首页缓存兜底
  if (!id) {
    var ids = Object.keys(HG_CACHE);
    if (ids.length === 1) id = ids[0];
  }

  if (!id) {
    throw new Error(
      "无法识别剧集ID，请截图运行日志"
    );
  }

  var data = await getPage(
    HG_BASE + "/detail?series_id=" +
    encodeURIComponent(id)
  );

  var route = getRoute(data, "detail_page");
  var detail = route.seriesDetail || {};

  var title = String(
    pick(detail, [
      "series_name", "series_title", "title"
    ]) ||
    (HG_CACHE[id] && HG_CACHE[id].title) ||
    "红果短剧"
  );

  var cover = String(
    pick(detail, ["series_cover", "cover"]) ||
    (HG_CACHE[id] && HG_CACHE[id].cover) ||
    ""
  );

  var intro = String(
    pick(detail, [
      "series_intro", "description", "intro"
    ]) || ""
  );

  var vids = detail.vid_list || [];

  var episodes = vids.map(function (vid, index) {
    return {
      id: String(vid),
      title: "第" + (index + 1) + "集",
      name: "第" + (index + 1) + "集",
      url: String(vid)
    };
  });

  if (!episodes.length) {
    throw new Error(
      "详情已获取，但未找到真实分集ID"
    );
  }

  return {
    id: id,
    title: title,
    name: title,
    cover: cover,
    description: intro,
    episodeCount: Number(
      detail.episode_cnt || episodes.length
    ),
    episodes: episodes
  };
};

// 播放：暂时保留公开测试视频
var extractStreamUrl = async function () {
  return {
    url: "https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8"
  };
};
