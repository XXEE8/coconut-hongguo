
/*
 * Coconut Hongguo Catalog v0.2.5
 * 红果官网真实短剧目录测试
 *
 * 只获取公开作品信息
 * 暂不接入正片播放
 */

var HG_BASE = "https://hongguoduanju.com";

function hgText(v) {
  if (v === null || v === undefined) return "";
  return String(v);
}

function hgParse(html) {
  var pos = html.indexOf("_ROUTER_DATA");
  if (pos < 0) {
    throw new Error("页面没有 _ROUTER_DATA");
  }

  var start = html.indexOf("{", pos);
  if (start < 0) {
    throw new Error("没有 JSON 起点");
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

  throw new Error("JSON 不完整");
}

function hgCard(id, title, cover, desc) {
  return {
    id: hgText(id),
    title: hgText(title),
    name: hgText(title),
    cover: hgText(cover),
    description: hgText(desc)
  };
}

function hgFindList(obj, depth) {
  if (!obj || depth > 5) return null;

  if (Array.isArray(obj)) return null;

  if (typeof obj !== "object") return null;

  if (
    Array.isArray(obj.recommendList) &&
    obj.recommendList.length > 0
  ) {
    return obj.recommendList;
  }

  if (
    Array.isArray(obj.categoryData) &&
    obj.categoryData.length > 0
  ) {
    return obj.categoryData;
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
    ) {
      continue;
    }

    var result = hgFindList(
      obj[key],
      depth + 1
    );

    if (result) return result;
  }

  return null;
}

function hgConvert(item, index) {
  var v = item.video_data ||
          item.videoData ||
          item;

  var id =
    v.series_id ||
    v.seriesId ||
    v.book_id ||
    v.bookId ||
    item.series_id ||
    "";

  var title =
    v.series_name ||
    v.seriesName ||
    v.book_name ||
    v.title ||
    v.name ||
    item.title ||
    "";

  var cover =
    v.series_cover ||
    v.seriesCover ||
    v.cover ||
    v.cover_url ||
    v.book_cover ||
    item.cover ||
    "";

  var desc =
    v.description ||
    v.intro ||
    v.abstract ||
    item.description ||
    "";

  if (!id && !title) return null;

  return hgCard(
    id || "unknown_" + index,
    title || "未提供剧名",
    cover,
    desc
  );
}

var home = async function () {
  var urls = [
    HG_BASE + "/category/real-drama?page=1",
    HG_BASE + "/category?tab=1&sort_type=1"
  ];

  var cards = [];
  var reports = [];

  for (var n = 0; n < urls.length; n++) {
    try {
      var response = await fetch(urls[n]);

      if (!response.ok) {
        throw new Error("HTTP " + response.status);
      }

      var html = await response.text();
      var router = hgParse(html);
      var loader = router.loaderData || {};

      var list = hgFindList(loader, 0);

      if (!list || list.length === 0) {
        reports.push(
          "线路" + (n + 1) +
          "：未发现非空 recommendList；路由：" +
          Object.keys(loader).join(",")
        );
        continue;
      }

      for (var i = 0; i < list.length; i++) {
        var card = hgConvert(list[i], i);
        if (card) cards.push(card);
      }

      if (cards.length > 0) break;

      reports.push(
        "线路" + (n + 1) +
        "：找到 " + list.length +
        " 条，但未识别剧名或ID"
      );

    } catch (e) {
      reports.push(
        "线路" + (n + 1) +
        "：" + hgText(e.message || e)
      );
    }
  }

  if (cards.length === 0) {
    cards.push(
      hgCard(
        "diag025",
        "v0.2.5 未找到真实短剧",
        "",
        reports.join("；")
      )
    );

    for (var j = 0; j < reports.length; j++) {
      cards.push(
        hgCard(
          "report_" + j,
          reports[j],
          "",
          "目录请求诊断结果"
        )
      );
    }
  }

  return {
    list: cards,
    items: cards,
    videos: cards
  };
};

var extractDetails = async function (item) {
  var id = "";

  if (typeof item === "string") {
    id = item;
  } else if (item) {
    id = hgText(
      item.id ||
      item.series_id ||
      item.seriesId ||
      ""
    );
  }

  return {
    id: id,
    title: "红果短剧目录测试",
    description:
      "已进入作品详情测试阶段，" +
      "真实剧集接口尚未接入",
    episodes: [
      {
        id: "catalog_test",
        title: "目录测试",
        name: "目录测试"
      }
    ]
  };
};

var extractStreamUrl = async function () {
  return {
    url: ""
  };
};
