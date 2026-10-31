
/*
 * Coconut Hongguo Probe v0.2.2
 * 首页数据结构诊断版
 *
 * 不播放红果正片
 * 播放接口保留公开 HLS 测试地址
 */

var HG_BASE = "https://hongguoduanju.com";

function hgKeys(value) {
  if (!value || typeof value !== "object") {
    return "非对象";
  }

  return Object.keys(value).slice(0, 15).join(", ") || "空对象";
}

function hgType(value) {
  if (Array.isArray(value)) {
    return "数组(" + value.length + ")";
  }

  if (value === null) return "null";

  return typeof value;
}

function hgParseRouterData(html) {
  var pos = html.indexOf("_ROUTER_DATA");

  if (pos < 0) {
    throw new Error("网页中没有 _ROUTER_DATA");
  }

  var start = html.indexOf("{", pos);

  if (start < 0) {
    throw new Error("没有找到 JSON 起始位置");
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
          return JSON.parse(html.slice(start, i + 1));
        }
      }
    }
  }

  throw new Error("JSON 解析范围不完整");
}

function hgCard(index, title, description) {
  var name = String(title || "未知").slice(0, 90);

  return {
    id: "diag_" + index,
    title: name,
    name: name,
    cover: "",
    description: String(description || "").slice(0, 1000)
  };
}

function hgCollect(data) {
  var cards = [];

  cards.push(hgCard(
    cards.length,
    "01 顶层字段",
    hgKeys(data)
  ));

  var loader = data.loaderData || {};

  cards.push(hgCard(
    cards.length,
    "02 loaderData 字段",
    hgKeys(loader)
  ));

  var names = Object.keys(loader);

  for (var i = 0; i < names.length; i++) {
    var routeName = names[i];
    var route = loader[routeName];

    cards.push(hgCard(
      cards.length,
      "03 路由：" + routeName,
      hgKeys(route)
    ));

    if (!route || typeof route !== "object") {
      continue;
    }

    var fields = Object.keys(route);

    for (var j = 0; j < fields.length; j++) {
      var field = fields[j];
      var value = route[field];

      cards.push(hgCard(
        cards.length,
        "字段：" + field,
        hgType(value) + " | " + hgKeys(value)
      ));

      if (Array.isArray(value) && value.length) {
        cards.push(hgCard(
          cards.length,
          "数组首项：" + field,
          hgKeys(value[0])
        ));
      }

      if (
        value &&
        typeof value === "object" &&
        !Array.isArray(value)
      ) {
        var innerFields = Object.keys(value);

        for (var k = 0; k < innerFields.length; k++) {
          var innerName = innerFields[k];
          var innerValue = value[innerName];

          cards.push(hgCard(
            cards.length,
            field + "." + innerName,
            hgType(innerValue) + " | " +
            hgKeys(innerValue)
          ));

          if (
            Array.isArray(innerValue) &&
            innerValue.length
          ) {
            cards.push(hgCard(
              cards.length,
              "首项：" + innerName,
              hgKeys(innerValue[0])
            ));
          }

          if (cards.length >= 70) break;
        }
      }

      if (cards.length >= 70) break;
    }

    if (cards.length >= 70) break;
  }

  return cards;
}

// 首页：显示诊断卡片
var home = async function () {
  var url = HG_BASE +
    "/category?tab=1&sort_type=1";

  var response = await fetch(url);

  if (!response.ok) {
    throw new Error(
      "红果官网 HTTP " + response.status
    );
  }

  var html = await response.text();

  var data = hgParseRouterData(html);

  var items = hgCollect(data);

  if (!items.length) {
    items = [
      hgCard(0, "没有诊断数据", "网页结构为空")
    ];
  }

  return {
    list: items,
    items: items,
    videos: items
  };
};

// 详情：显示对应诊断卡片的信息
var extractDetails = async function (input) {
  var title = "红果数据诊断";
  var description = "请查看首页诊断卡片";

  if (input && typeof input === "object") {
    title = input.title || input.name || title;
    description = input.description || description;
  }

  return {
    id: "diagnostic",
    title: title,
    name: title,
    description: description,
    episodes: [{
      id: "test_episode",
      title: "测试播放",
      name: "测试播放"
    }]
  };
};

// 播放：继续使用公开测试视频
var extractStreamUrl = async function () {
  return {
    url: "https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8"
  };
};
