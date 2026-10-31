
/*
 * Coconut Hongguo Probe v0.2.3
 * 精准诊断 category_$ 数据结构
 *
 * 仅诊断公开网页数据
 * 不访问红果正片播放接口
 */

var HG_BASE = "https://hongguoduanju.com";

function hgType(v) {
  if (Array.isArray(v)) {
    return "数组(" + v.length + ")";
  }
  if (v === null) return "null";
  return typeof v;
}

function hgKeys(v) {
  if (!v || typeof v !== "object") {
    return String(v).slice(0, 100);
  }

  return Object.keys(v).slice(0, 12).join(",");
}

function hgCard(index, title, detail) {
  var name = String(title).slice(0, 110);

  return {
    id: "diag_" + index,
    title: name,
    name: name,
    cover: "",
    description: String(detail || "").slice(0, 800)
  };
}

function hgParseRouterData(html) {
  var p = html.indexOf("_ROUTER_DATA");

  if (p < 0) {
    throw new Error("未找到 _ROUTER_DATA");
  }

  var start = html.indexOf("{", p);

  if (start < 0) {
    throw new Error("未找到 JSON 起始位置");
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

function hgInspect(value, path, cards, depth) {
  if (cards.length >= 45 || depth > 3) {
    return;
  }

  var type = hgType(value);
  var keys = hgKeys(value);

  cards.push(
    hgCard(
      cards.length,
      path + " [" + type + "]",
      keys
    )
  );

  if (!value || typeof value !== "object") {
    return;
  }

  if (Array.isArray(value)) {
    if (value.length > 0) {
      hgInspect(
        value[0],
        path + "[0]",
        cards,
        depth + 1
      );
    }
    return;
  }

  var fields = Object.keys(value);

  for (var i = 0; i < fields.length; i++) {
    if (cards.length >= 45) break;

    var key = fields[i];

    // 跳过不相关的请求环境字段
    if (
      key === "req" ||
      key === "request" ||
      key === "headers" ||
      key === "context"
    ) {
      continue;
    }

    hgInspect(
      value[key],
      path + "." + key,
      cards,
      depth + 1
    );
  }
}

var home = async function () {
  var response = await fetch(
    HG_BASE + "/category?tab=1&sort_type=1"
  );

  if (!response.ok) {
    throw new Error(
      "HTTP " + response.status
    );
  }

  var html = await response.text();
  var data = hgParseRouterData(html);

  var loader = data.loaderData || {};
  var cards = [];

  cards.push(
    hgCard(
      cards.length,
      "v0.2.3 精准诊断",
      "只检查 category_$"
    )
  );

  cards.push(
    hgCard(
      cards.length,
      "loaderData 路由：" +
        Object.keys(loader).join(","),
      "检查是否包含 category_$"
    )
  );

  var route = loader["category_$"];

  if (!route) {
    cards.push(
      hgCard(
        cards.length,
        "未找到 category_$",
        "现有路由：" +
          Object.keys(loader).join(",")
      )
    );
  } else {
    hgInspect(
      route,
      "category_$",
      cards,
      0
    );
  }

  return {
    list: cards,
    items: cards,
    videos: cards
  };
};

// 详情：诊断占位
var extractDetails = async function () {
  return {
    id: "diagnostic",
    title: "v0.2.3 数据诊断",
    name: "v0.2.3 数据诊断",
    description: "请查看首页卡片标题",
    episodes: [
      {
        id: "test",
        title: "测试集",
        name: "测试集"
      }
    ]
  };
};

// 播放：保留已验证的测试地址
var extractStreamUrl = async function () {
  return {
    url:
      "https://test-streams.mux.dev/" +
      "x36xhzz/x36xhzz.m3u8"
  };
};
