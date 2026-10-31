/*
 * Coconut 红果短剧 v0.4.3
 *
 * 搜索详情 HTTP 404 修复实验
 *
 * 1. 保留联想搜索
 * 2. 保存联想接口原始 video_data
 * 3. 依次测试两种官网详情路径
 * 4. 详情失败时检查原始 vid_list
 * 5. 不伪造集数或 VID
 * 6. 播放逻辑保持 v0.3.1
 *
 * 无登录功能
 */

var HG_BASE = "https://hongguoduanju.com";
var HG_UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36";

var HG_SERIES = {};
var HG_CACHE = {};
var HG_RAW = {};
var HG_KEYWORD = "归路";

function hgS(v) {
  return v == null ? "" : String(v);
}

function hgPick(o, keys) {
  if (!o || typeof o !== "object") return "";
  for (var i = 0; i < keys.length; i++) {
    var v = o[keys[i]];
    if (v !== undefined && v !== null && v !== "") {
      return v;
    }
  }
  return "";
}

function hgErr(e) {
  return hgS(e && e.message ? e.message : e);
}

function hgHeaders(json) {
  var h = {
    "Accept": json
      ? "application/json"
      : "text/html,application/xhtml+xml",
    "Referer": HG_BASE + "/",
    "User-Agent": HG_UA
  };
  if (json) h["Content-Type"] = "application/json";
  return h;
}

async function hgRequest(url, options) {
  var r = await fetch(url, options || {
    method: "GET",
    headers: hgHeaders(false)
  });
  if (!r.ok) throw Error("HTTP " + r.status);
  return r;
}

function hgParse(html) {
  var pos = html.indexOf("_ROUTER_DATA");
  if (pos < 0) {
    throw Error("页面缺少 _ROUTER_DATA");
  }

  var start = html.indexOf("{", pos);
  if (start < 0) throw Error("页面缺少 JSON");

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

async function hgPage(url) {
  var r = await hgRequest(url);
  return hgParse(await r.text());
}

async function hgPost(path, body) {
  var r = await hgRequest(HG_BASE + path, {
    method: "POST",
    headers: hgHeaders(true),
    body: JSON.stringify(body)
  });
  return await r.json();
}

function hgFind(obj, predicate, depth) {
  if (!obj || typeof obj !== "object" || depth > 8) {
    return null;
  }
  if (predicate(obj)) return obj;

  var keys = Object.keys(obj);
  for (var i = 0; i < keys.length; i++) {
    var key = keys[i];
    if (/^(req|request|headers)$/.test(key)) continue;
    var found = hgFind(
      obj[key], predicate, depth + 1
    );
    if (found) return found;
  }
  return null;
}

function hgId(item) {
  if (
    typeof item === "string" ||
    typeof item === "number"
  ) return hgS(item);

  return hgS(hgPick(item, [
    "id", "vid", "video_id", "videoId",
    "series_id", "seriesId"
  ]));
}

function hgURL(value) {
  if (typeof value !== "string") return "";
  var url = value.trim();
  if (url.indexOf("//") === 0) url = "https:" + url;
  return /^https?:\/\/\S+$/i.test(url) ? url : "";
}

function hgMedia(info) {
  if (!info) return "";
  if (typeof info === "string") return hgURL(info);

  var fields = [
    "main_url", "backup_url", "backup_url_1",
    "play_url", "video_url", "url"
  ];

  for (var i = 0; i < fields.length; i++) {
    var v = info[fields[i]];

    if (typeof v === "string") {
      var url = hgURL(v);
      if (url) return url;
    }

    if (v && typeof v === "object") {
      var nested = hgURL(v.main_url || v.url);
      if (nested) return nested;
    }
  }
  return "";
}

function hgResult(cards) {
  return {
    list: cards,
    items: cards,
    videos: cards
  };
}

function hgCard(entry) {
  if (!entry || typeof entry !== "object") {
    return null;
  }

  var v = entry.video_data || entry.videoData || entry;

  var id = hgS(hgPick(v, [
    "series_id", "seriesId", "book_id"
  ]));

  if (!/^\d+$/.test(id)) return null;

  var title = hgS(
    hgPick(v, [
      "series_name", "series_title",
      "seriesName", "title", "name"
    ]) ||
    entry.name ||
    (entry.display_words && entry.display_words[0])
  );

  var cover = hgS(hgPick(v, [
    "series_cover", "seriesCover",
    "cover", "cover_url"
  ]));

  var card = {
    id: id,
    title: title || "未命名短剧",
    name: title || "未命名短剧",
    cover: cover,
    description: hgS(hgPick(v, [
      "series_intro", "description", "intro"
    ]))
  };

  HG_CACHE[id] = card;
  HG_RAW[id] = v;

  return card;
}

function hgCards(raw) {
  var cards = [];
  var seen = {};

  for (var i = 0; i < raw.length; i++) {
    var card = hgCard(raw[i]);
    if (card && !seen[card.id]) {
      seen[card.id] = true;
      cards.push(card);
    }
  }
  return cards;
}

function hgStatus(message) {
  return {
    id: "diag043",
    title: "状态：" + message,
    name: "状态：" + message,
    cover: "",
    description: message
  };
}

/* 搜索联想接口：v0.4.1 已验证 */

async function hgSuggest(keyword) {
  keyword = hgS(keyword).trim();
  if (!keyword) return [];

  var url = HG_BASE +
    "/incent_resource/suggestion?app_id=8662&query=" +
    encodeURIComponent(keyword) +
    "&count=20";

  var r = await hgRequest(url, {
    method: "GET",
    headers: {
      "Accept": "application/json, text/plain, */*",
      "Referer": HG_BASE + "/",
      "User-Agent": HG_UA
    }
  });

  var data = await r.json();
  var raw = data && data.suggest_list;

  if (!Array.isArray(raw)) {
    throw Error("没有 suggest_list");
  }

  return hgCards(raw);
}

/* 原版首页 */

async function hgOriginalHome() {
  var urls = [
    HG_BASE + "/category/real-drama?page=1",
    HG_BASE + "/category?tab=1&sort_type=1"
  ];

  var errors = [];

  for (var i = 0; i < urls.length; i++) {
    try {
      var router = await hgPage(urls[i]);

      var node = hgFind(
        router.loaderData || {},
        function(o) {
          return Array.isArray(o.recommendList) &&
            o.recommendList.length > 0;
        },
        0
      );

      if (!node) continue;

      var cards = hgCards(node.recommendList);
      if (cards.length) return cards;

    } catch(e) {
      errors.push(hgErr(e));
    }
  }

  throw Error(errors.join("；"));
}

/* 首页 */

var home = async function() {
  var message = "";

  try {
    var cards = await hgSuggest(HG_KEYWORD);

    if (cards.length) {
      return hgResult(cards);
    }

    message = "联想结果为空";

  } catch(e) {
    message = hgErr(e);
  }

  try {
    var original = await hgOriginalHome();
    original.unshift(hgStatus(message));
    return hgResult(original);
  } catch(e) {
    return hgResult([
      hgStatus(
        "搜索：" + message +
        "；首页：" + hgErr(e)
      )
    ]);
  }
};

/* 搜索回调：Coconut 支持情况待验证 */

function hgKeyword(payload) {
  if (
    typeof payload === "string" ||
    typeof payload === "number"
  ) return hgS(payload).trim();

  return hgS(hgPick(payload, [
    "keyword", "query", "wd", "text",
    "searchText", "searchTerm", "name"
  ])).trim();
}

var search = async function(payload) {
  var keyword = hgKeyword(payload);
  if (!keyword) return hgResult([]);

  try {
    return hgResult(await hgSuggest(keyword));
  } catch(e) {
    return hgResult([
      hgStatus("搜索失败：" + hgErr(e))
    ]);
  }
};

var searchVideos = search;
var searchVideo = search;

/*
 * 详情解析
 *
 * 首选官网标准详情接口；
 * 第二次尝试路径式详情接口。
 */

async function hgGetDetail(seriesId) {
  var urls = [
    HG_BASE + "/detail?series_id=" +
      encodeURIComponent(seriesId),

    HG_BASE + "/detail/" +
      encodeURIComponent(seriesId)
  ];

  var errors = [];

  for (var i = 0; i < urls.length; i++) {
    try {
      var router = await hgPage(urls[i]);

      var node = hgFind(
        router.loaderData || {},
        function(o) {
          return !!(
            o.seriesDetail &&
            typeof o.seriesDetail === "object"
          );
        },
        0
      );

      if (node) {
        return {
          detail: node.seriesDetail,
          source: "详情路径" + (i + 1)
        };
      }

      errors.push(
        "路径" + (i + 1) + ":无seriesDetail"
      );

    } catch(e) {
      errors.push(
        "路径" + (i + 1) + ":" + hgErr(e)
      );
    }
  }

  /*
   * 搜索结果可能自带完整的 vid_list。
   * 只有真实存在 VID 时才使用。
   */

  var raw = HG_RAW[seriesId];

  if (
    raw &&
    raw.vid_list &&
    (Array.isArray(raw.vid_list) ||
     typeof raw.vid_list === "object")
  ) {
    return {
      detail: raw,
      source: "搜索原始数据"
    };
  }

  throw Error(
    "详情获取失败；ID=" + seriesId +
    "；" + errors.join("；") +
    "；搜索数据字段=" +
    Object.keys(raw || {}).join(",").slice(0,150)
  );
}

/* 详情入口 */

var extractDetails = async function(item) {
  var seriesId = hgId(item);

  if (!/^\d+$/.test(seriesId)) {
    throw Error("无效 series_id");
  }

  var result = await hgGetDetail(seriesId);
  var detail = result.detail;
  var cached = HG_CACHE[seriesId] || {};

  var title = hgS(hgPick(detail, [
    "series_name", "series_title", "title"
  ]) || cached.title);

  var cover = hgS(hgPick(detail, [
    "series_cover", "cover"
  ]) || cached.cover);

  var desc = hgS(hgPick(detail, [
    "series_intro", "description", "intro"
  ]) || cached.description);

  var raw = detail.vid_list || [];

  if (!Array.isArray(raw)) {
    raw = raw && typeof raw === "object"
      ? Object.values(raw)
      : [];
  }

  var episodes = [];

  for (var i = 0; i < raw.length; i++) {
    var entry = raw[i];

    var vid = typeof entry === "object"
      ? hgS(hgPick(entry, [
          "vid", "video_id", "videoId", "id"
        ]))
      : hgS(entry);

    if (!/^\d+$/.test(vid)) continue;

    HG_SERIES[vid] = seriesId;

    episodes.push({
      id: vid,
      title: "第" + (i + 1) + "集",
      name: "第" + (i + 1) + "集",
      episode: i + 1,
      index: i + 1
    });
  }

  if (!episodes.length) {
    throw Error(
      "未取得有效 VID；ID=" + seriesId +
      "；数据来源=" + result.source +
      "；原始字段=" +
      Object.keys(detail).join(",").slice(0,130)
    );
  }

  var count = Number(
    detail.episode_cnt || episodes.length
  );

  if (!Number.isFinite(count)) {
    count = episodes.length;
  }

  desc += "\n数据来源：" + result.source;
  desc += "\n总集数：" + count;
  desc += "\n已解析选集：" + episodes.length;

  return {
    id: seriesId,
    title: title,
    name: title,
    cover: cover,
    description: desc,
    episodeCount: count,
    episodes: episodes
  };
};

/*
 * 以下播放部分沿用 v0.3.1
 */

async function hgWeb(seriesId, vid) {
  var router = await hgPage(
    HG_BASE + "/player/" +
    encodeURIComponent(seriesId) + "/" +
    encodeURIComponent(vid)
  );

  var page = hgFind(
    router.loaderData || {},
    function(o) {
      return !!(
        o.video_player_info || o.publicVideoSeo
      );
    },
    0
  );

  if (!page) throw Error("没有播放页数据");

  if (page.vid && hgS(page.vid) !== vid) {
    throw Error("播放页 VID 不匹配");
  }

  if (
    page.series_id &&
    hgS(page.series_id) !== seriesId
  ) {
    throw Error("播放页 series_id 不匹配");
  }

  var url = hgMedia(page.video_player_info);
  if (url) return url;

  var seo = page.publicVideoSeo;

  if (
    seo &&
    seo.available === true &&
    hgS(seo.seriesId) === seriesId &&
    hgS(seo.itemId) === vid
  ) {
    return HG_BASE + "/video/public/" +
      encodeURIComponent(vid) + "/360p.mp4";
  }

  throw Error("没有公开媒体地址");
}

async function hgFallback(vid) {
  var data = await hgPost(
    "/api/video/protected/fallback-play-info",
    {item_id: vid}
  );

  var url = hgURL(data && data.main_url);

  if (!url) throw Error("没有 main_url");
  return url;
}

async function hgProtected(seriesId, vid) {
  var definitions = ["720p", "480p", "360p"];
  var errors = [];

  for (var i = 0; i < definitions.length; i++) {
    var definition = definitions[i];

    try {
      var data = await hgPost(
        "/api/video/protected/play-info",
        {
          series_id: seriesId,
          item_id: vid,
          definition: definition
        }
      );

      var info = data && data.play_info;
      if (!info) throw Error("没有 play_info");

      var key = hgS(
        info.player_access_key
      ).trim();

      if (
        info.encrypted === true ||
        info.is_encrypted === true ||
        info.drm ||
        info.decryption ||
        /^[0-9a-fA-F]{32}$/.test(key)
      ) {
        throw Error(
          "需要额外解密，当前模块不支持"
        );
      }

      var url = hgMedia(info);
      if (!url) throw Error("没有媒体地址");

      return url;

    } catch(e) {
      errors.push(
        definition + ":" + hgErr(e)
      );
    }
  }

  throw Error(errors.join("；"));
}

var extractStreamUrl = async function(input) {
  var vid = hgId(input);

  if (!/^\d+$/.test(vid)) {
    throw Error("v0.3.1：无效 VID");
  }

  var seriesId = HG_SERIES[vid] || "";
  var errors = [];

  if (seriesId) {
    try {
      var publicURL = await hgWeb(seriesId, vid);
      if (publicURL) return {url: publicURL};
    } catch(e) {
      errors.push("网页：" + hgErr(e));
    }
  } else {
    errors.push("没有 series_id");
  }

  try {
    var fallbackURL = await hgFallback(vid);
    if (fallbackURL) return {url: fallbackURL};
  } catch(e) {
    errors.push("MP4兜底：" + hgErr(e));
  }

  if (seriesId) {
    try {
      var protectedURL = await hgProtected(
        seriesId, vid
      );
      if (protectedURL) return {url: protectedURL};
    } catch(e) {
      errors.push("play-info：" + hgErr(e));
    }
  }

  throw Error(
    "v0.3.1 播放失败；" +
    errors.join(" | ").slice(0,650)
  );
};
