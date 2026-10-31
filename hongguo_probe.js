
/*
 * Coconut × Hongguo
 * v0.1.0 - Real catalogue probe
 * Test: public website catalogue
 */

var HG_BASE = "https://hongguoduanju.com";

function hgPick(obj, keys) {
  if (!obj) return "";
  for (var i = 0; i < keys.length; i++) {
    var v = obj[keys[i]];
    if (v !== undefined && v !== null && v !== "") {
      return v;
    }
  }
  return "";
}

function hgRouterData(html) {
  var marker = "_ROUTER_DATA";
  var p = html.indexOf(marker);
  if (p < 0) throw new Error("未找到网页数据");

  var start = html.indexOf("{", p);
  if (start < 0) throw new Error("未找到 JSON");

  var depth = 0;
  var quoted = false;
  var escaped = false;

  for (var i = start; i < html.length; i++) {
    var c = html[i];

    if (quoted) {
      if (escaped) escaped = false;
      else if (c === "\\") escaped = true;
      else if (c === '"') quoted = false;
    } else {
      if (c === '"') quoted = true;
      else if (c === "{") depth++;
      else if (c === "}") {
        depth--;
        if (depth === 0) {
          return JSON.parse(html.slice(start, i + 1));
        }
      }
    }
  }
  throw new Error("JSON 数据不完整");
}

function hgItems(data) {
  var loader = data.loaderData || {};
  var route = loader.category_page ||
              loader["category_$"] ||
              Object.values(loader)[0] || {};

  var candidates = [
    route.recommendList,
    route.categoryData && route.categoryData.recommendList,
    route.data && route.data.recommendList
  ];

  var list = [];
  for (var i = 0; i < candidates.length; i++) {
    if (Array.isArray(candidates[i])) {
      list = candidates[i];
      break;
    }
  }

  return list.map(function (entry) {
    var v = entry.video_data ||
            entry.videoData ||
            entry;

    var id = String(hgPick(v, [
      "series_id", "seriesId", "id"
    ]));

    var title = String(hgPick(v, [
      "title", "name", "series_name", "seriesName"
    ]));

    var cover = hgPick(v, [
      "cover", "cover_url", "coverUrl",
      "thumb_url", "poster"
    ]);

    if (cover && typeof cover === "object") {
      cover = hgPick(cover, ["url", "uri"]);
    }

    return {
      id: id,
      title: title || "红果短剧",
      name: title || "红果短剧",
      cover: String(cover || ""),
      description: String(hgPick(v, [
        "description", "intro", "abstract"
      ])),
      url: HG_BASE + "/detail/" + encodeURIComponent(id)
    };
  }).filter(function (item) {
    return !!item.id;
  });
}

async function hgHome() {
  var url = HG_BASE + "/category?tab=1&sort_type=1";
  var response = await fetch(url);

  if (!response.ok) {
    throw new Error("官网请求失败 HTTP " + response.status);
  }

  var html = await response.text();
  var data = hgRouterData(html);
  var items = hgItems(data);

  if (!items.length) {
    throw new Error("官网返回数据，但未匹配到短剧列表");
  }

  return { list: items, items: items };
}

async function hgDetails(item) {
  var id = String(
    (item && (item.id || item.series_id)) || ""
  );

  return {
    id: id,
    title: item && (item.title || item.name) || "红果短剧",
    name: item && (item.title || item.name) || "红果短剧",
    cover: item && item.cover || "",
    description: "真实红果目录测试，剧集接口尚未接入",
    episodes: [{
      id: "probe",
      title: "播放接口测试",
      name: "播放接口测试"
    }]
  };
}

async function hgStream() {
  return {
    url: "https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8"
  };
}

globalThis.home = hgHome;
globalThis.extractDetails = hgDetails;
globalThis.extractStreamUrl = hgStream;
