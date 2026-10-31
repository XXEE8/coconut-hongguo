
/*
 * Coconut Hongguo Probe v0.2.1
 *
 * 1. 真实红果短剧目录
 * 2. 尝试获取真实剧集详情
 * 3. 尝试获取真实分集 ID
 * 4. 播放仍使用公开 HLS 测试视频
 */

var HG_BASE = "https://hongguoduanju.com";
var HG_CACHE = {};

function hgPick(obj, keys) {
  if (!obj || typeof obj !== "object") {
    return "";
  }

  for (var i = 0; i < keys.length; i++) {
    var value = obj[keys[i]];

    if (
      value !== undefined &&
      value !== null &&
      value !== ""
    ) {
      return value;
    }
  }

  return "";
}

function hgParseRouterData(html) {
  var marker = "_ROUTER_DATA";
  var position = html.indexOf(marker);

  if (position < 0) {
    throw new Error("未找到网页数据");
  }

  var start = html.indexOf("{", position);

  if (start < 0) {
    throw new Error("未找到 JSON");
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
    } else {
      if (c === '"') {
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
  }

  throw new Error("JSON 数据不完整");
}

async function hgGetPage(url) {
  var response = await fetch(url);

  if (!response.ok) {
    throw new Error(
      "请求失败 HTTP " + response.status
    );
  }

  var html = await response.text();

  return hgParseRouterData(html);
}

function hgFindRoute(data, preferred) {
  var loader = data.loaderData || {};

  if (loader[preferred]) {
    return loader[preferred];
  }

  var values = Object.values(loader);

  return values.length ? values[0] : {};
}

function hgFindList(route) {
  var candidates = [
    route.recommendList,

    route.categoryData &&
      route.categoryData.recommendList,

    route.data &&
      route.data.recommendList
  ];

  for (var i = 0; i < candidates.length; i++) {
    if (Array.isArray(candidates[i])) {
      return candidates[i];
    }
  }

  return [];
}

function hgMakeItem(entry) {
  var v =
    entry.video_data ||
    entry.videoData ||
    entry;

  var id = String(
    hgPick(v, [
      "series_id",
      "seriesId",
      "id"
    ])
  );

  var title = String(
    hgPick(v, [
      "series_name",
      "series_title",
      "seriesName",
      "title",
      "name"
    ]) ||
    hgPick(entry, [
      "title",
      "name"
    ]) ||
    "红果短剧"
  );

  var cover = hgPick(v, [
    "series_cover",
    "cover",
    "cover_url",
    "coverUrl",
    "thumb_url",
    "poster"
  ]);

  if (
    cover &&
    typeof cover === "object"
  ) {
    cover = hgPick(cover, [
      "url",
      "uri"
    ]);
  }

  var description = String(
    hgPick(v, [
      "series_intro",
      "description",
      "intro",
      "abstract"
    ]) || ""
  );

  var item = {
    id: id,
    title: title,
    name: title,
    cover: String(cover || ""),
    description: description,
    url:
      HG_BASE +
      "/detail?series_id=" +
      encodeURIComponent(id)
  };

  if (id) {
    HG_CACHE[id] = item;
  }

  return item;
}

function hgResolveId(input) {
  if (
    typeof input === "string" ||
    typeof input === "number"
  ) {
    var value = String(input);

    var match = value.match(
      /series_id=([^&#]+)/
    );

    if (match) {
      return decodeURIComponent(match[1]);
    }

    if (/^\d+$/.test(value)) {
      return value;
    }

    return "";
  }

  if (
    input &&
    typeof input === "object"
  ) {
    var candidate = hgPick(input, [
      "id",
      "series_id",
      "seriesId",
      "url",
      "link"
    ]);

    if (candidate) {
      return hgResolveId(candidate);
    }
  }

  return "";
}

// =========================
// 首页：真实红果短剧目录
// =========================

var home = async function () {
  var data = await hgGetPage(
    HG_BASE +
    "/category?tab=1&sort_type=1"
  );

  var route = hgFindRoute(
    data,
    "category_page"
  );

  var list = hgFindList(route);

  var items = list
    .map(hgMakeItem)
    .filter(function (item) {
      return !!item.id;
    });

  if (!items.length) {
    throw new Error(
      "未找到红果短剧目录"
    );
  }

  return {
    list: items,
    items: items,
    videos: items
  };
};

// =========================
// 详情：尝试获取真实剧集
// =========================

var extractDetails = async function (input) {
  var id = hgResolveId(input);

  if (!id) {
    var cachedIds = Object.keys(
      HG_CACHE
    );

    if (cachedIds.length === 1) {
      id = cachedIds[0];
    }
  }

  if (!id) {
    throw new Error(
      "无法识别剧集ID"
    );
  }

  var data = await hgGetPage(
    HG_BASE +
    "/detail?series_id=" +
    encodeURIComponent(id)
  );

  var route = hgFindRoute(
    data,
    "detail_page"
  );

  var detail =
    route.seriesDetail ||
    (route.data &&
      route.data.seriesDetail) ||
    {};

  var cached = HG_CACHE[id] || {};

  var title = String(
    hgPick(detail, [
      "series_name",
      "series_title",
      "title",
      "name"
    ]) ||
    cached.title ||
    "红果短剧"
  );

  var cover = hgPick(detail, [
    "series_cover",
    "cover",
    "cover_url"
  ]);

  if (
    cover &&
    typeof cover === "object"
  ) {
    cover = hgPick(cover, [
      "url",
      "uri"
    ]);
  }

  var description = String(
    hgPick(detail, [
      "series_intro",
      "description",
      "intro"
    ]) ||
    cached.description ||
    ""
  );

  var vids = detail.vid_list || [];

  if (!Array.isArray(vids)) {
    vids = [];
  }

  var episodes = vids.map(
    function (vid, index) {
      var episodeId =
        typeof vid === "object"
          ? hgPick(vid, [
              "vid",
              "video_id",
              "id"
            ])
          : vid;

      return {
        id: String(episodeId),
        title:
          "第" + (index + 1) + "集",
        name:
          "第" + (index + 1) + "集",
        url: String(episodeId)
      };
    }
  );

  if (!episodes.length) {
    throw new Error(
      "已请求详情，但未找到真实分集ID"
    );
  }

  return {
    id: id,
    title: title,
    name: title,
    cover: String(
      cover || cached.cover || ""
    ),
    description: description,
    episodeCount: Number(
      detail.episode_cnt ||
      episodes.length
    ),
    episodes: episodes
  };
};

// =========================
// 播放：公开测试视频
// =========================

var extractStreamUrl = async function () {
  return {
    url:
      "https://test-streams.mux.dev/" +
      "x36xhzz/x36xhzz.m3u8"
  };
};
