
/*
 * Coconut Hongguo Diagnostic v0.2.4
 * 展开 category_$ 真实数据
 */

var HG_URL =
  "https://hongguoduanju.com/category?tab=1&sort_type=1";

function hgType(value) {
  if (value === null) return "null";
  if (Array.isArray(value)) {
    return "array(" + value.length + ")";
  }
  return typeof value;
}

function hgShort(value, maxLength) {
  var str;

  try {
    if (typeof value === "string") {
      str = value;
    } else {
      str = JSON.stringify(value);
    }
  } catch (e) {
    str = String(value);
  }

  if (str === undefined) str = "undefined";

  return str.length > maxLength
    ? str.slice(0, maxLength) + "..."
    : str;
}

function hgCard(title, detail, index) {
  var text = String(title).slice(0, 180);

  return {
    id: "diag024_" + index,
    title: text,
    name: text,
    cover: "",
    description: String(detail || "").slice(0, 1000)
  };
}

function hgExtractJSON(html) {
  var marker = "_ROUTER_DATA";
  var pos = html.indexOf(marker);

  if (pos < 0) {
    throw new Error("找不到 _ROUTER_DATA");
  }

  var start = html.indexOf("{", pos);

  if (start < 0) {
    throw new Error("找不到 JSON 起点");
  }

  var depth = 0;
  var inString = false;
  var escapeNext = false;

  for (var i = start; i < html.length; i++) {
    var c = html[i];

    if (inString) {
      if (escapeNext) {
        escapeNext = false;
      } else if (c === "\\") {
        escapeNext = true;
      } else if (c === '"') {
        inString = false;
      }
      continue;
    }

    if (c === '"') {
      inString = true;
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

  throw new Error("JSON 解析不完整");
}

function hgInspect(value, path, cards, depth) {
  if (cards.length >= 80 || depth > 5) {
    return;
  }

  var type = hgType(value);
  var title = path + " [" + type + "]";

  if (
    value === null ||
    typeof value !== "object"
  ) {
    title += " = " + hgShort(value, 85);
  }

  cards.push(
    hgCard(
      title,
      hgShort(value, 900),
      cards.length
    )
  );

  if (
    value === null ||
    typeof value !== "object" ||
    depth >= 5
  ) {
    return;
  }

  if (Array.isArray(value)) {
    var count = Math.min(value.length, 3);

    for (var a = 0; a < count; a++) {
      hgInspect(
        value[a],
        path + "[" + a + "]",
        cards,
        depth + 1
      );
    }
    return;
  }

  var keys = Object.keys(value);

  for (var j = 0; j < keys.length; j++) {
    if (cards.length >= 80) break;

    var key = keys[j];

    // 排除网页请求环境中的无关信息
    if (
      key === "req" ||
      key === "request" ||
      key === "headers" ||
      key === "cookies" ||
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
  var response = await fetch(HG_URL);

  if (!response.ok) {
    throw new Error(
      "请求失败 HTTP " + response.status
    );
  }

  var html = await response.text();
  var routerData = hgExtractJSON(html);
  var loaderData = routerData.loaderData || {};

  var cards = [];

  cards.push(
    hgCard(
      "v0.2.4 数据展开诊断",
      "检查 category_$ 的实际内容",
      cards.length
    )
  );

  cards.push(
    hgCard(
      "路由列表：" +
        Object.keys(loaderData).join(", "),
      "loaderData 路由",
      cards.length
    )
  );

  var target = loaderData["category_$"];

  if (target === undefined) {
    cards.push(
      hgCard(
        "没有找到 category_$",
        "当前路由：" +
          Object.keys(loaderData).join(","),
        cards.length
      )
    );
  } else {
    hgInspect(
      target,
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

var extractDetails = async function () {
  return {
    id: "diag024",
    title: "红果数据结构诊断",
    name: "红果数据结构诊断",
    description: "请直接查看首页卡片内容",
    episodes: [
      {
        id: "test001",
        title: "测试集",
        name: "测试集"
      }
    ]
  };
};

var extractStreamUrl = async function () {
  return {
    url:
      "https://test-streams.mux.dev/" +
      "x36xhzz/x36xhzz.m3u8"
  };
};
