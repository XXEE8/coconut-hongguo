/*
 * Coconut 红果短剧 v0.4.5
 * 完整选集来源追踪版
 *
 * 保留：
 * - 联想搜索
 * - 搜索结果详情
 * - 已验证的3集播放
 * - v0.3.1播放请求逻辑
 *
 * 新增：
 * - 检查不同详情路径
 * - 检查嵌套选集数据
 * - 对比原首页同名剧集
 * - 标题显示实际选集数/总集数
 *
 * 不登录，不猜测VID
 */

var HG_BASE = "https://hongguoduanju.com";

var HG_UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) " +
  "AppleWebKit/537.36 (KHTML, like Gecko) " +
  "Chrome/140.0.0.0 Safari/537.36";

var HG_SERIES = {};
var HG_CACHE = {};
var HG_RAW = {};
var HG_HOME_MATCH = {};
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

  if (json) {
    h["Content-Type"] = "application/json";
  }
  return h;
}

async function hgRequest(url, options) {
  var r = await fetch(
    url,
    options || {
      method: "GET",
      headers: hgHeaders(false)
    }
  );

  if (!r.ok) {
    throw Error("HTTP " + r.status);
  }
  return r;
}

function hgParse(html) {
  var pos = html.indexOf("_ROUTER_DATA");

  if (pos < 0) {
    throw Error("缺少 _ROUTER_DATA");
  }

  var start = html.indexOf("{", pos);
  if (start < 0) {
    throw Error("缺少 JSON");
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
  if (!obj || typeof obj !== "object" || depth > 9) {
    return null;
  }

  if (predicate(obj)) {
    return obj;
  }

  var keys = Object.keys(obj);

  for (var i = 0; i < keys.length; i++) {
    var key = keys[i];

    if (/^(req|request|headers)$/.test(key)) {
      continue;
    }

    var found = hgFind(
      obj[key],
      predicate,
      depth + 1
    );

    if (found) return found;
  }

  return null;
}

function hgId(item) {
  if (
    typeof item === "string" ||
    typeof item === "number"
  ) {
    return hgS(item);
  }

  return hgS(hgPick(item, [
    "id",
    "vid",
    "video_id",
    "videoId",
    "series_id",
    "seriesId"
  ]));
}

function hgURL(value) {
  if (typeof value !== "string") {
    return "";
  }

  var url = value.trim();

  if (url.indexOf("//") === 0) {
    url = "https:" + url;
  }

  return /^https?:\/\/\S+$/i.test(url) ? url : "";
}

function hgMedia(info) {
  if (!info) return "";

  if (typeof info === "string") {
    return hgURL(info);
  }

  var fields = [
    "main_url",
    "backup_url",
    "backup_url_1",
    "play_url",
    "video_url",
    "url"
  ];

  for (var i = 0; i < fields.length; i++) {
    var value = info[fields[i]];

    if (typeof value === "string") {
      var url = hgURL(value);
      if (url) return url;
    }

    if (value && typeof value === "object") {
      var nested = hgURL(
        value.main_url || value.url
      );
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

  var v =
    entry.video_data ||
    entry.videoData ||
    entry;

  var id = hgS(hgPick(v, [
    "series_id",
    "seriesId",
    "book_id"
  ]));

  if (!/^\d+$/.test(id)) {
    return null;
  }

  var title = hgS(
    hgPick(v, [
      "series_name",
      "series_title",
      "seriesName",
      "title",
      "name"
    ]) ||
    entry.name ||
    (
      entry.display_words &&
      entry.display_words[0]
    )
  );

  var card = {
    id: id,
    title: title || "未命名短剧",
    name: title || "未命名短剧",
    cover: hgS(hgPick(v, [
      "series_cover",
      "seriesCover",
      "cover",
      "cover_url"
    ])),
    description: hgS(hgPick(v, [
      "series_intro",
      "description",
      "intro"
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

function hgStatus(msg) {
  return {
    id: "diag045",
    title: "诊断：" + msg,
    name: "诊断：" + msg,
    cover: "",
    description: msg
  };
}

/* 搜索接口 */

async function hgSuggest(keyword) {
  keyword = hgS(keyword).trim();

  if (!keyword) return [];

  var url =
    HG_BASE +
    "/incent_resource/suggestion?app_id=8662" +
    "&query=" + encodeURIComponent(keyword) +
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

  if (!Array.isArray(data && data.suggest_list)) {
    throw Error("没有 suggest_list");
  }

  return hgCards(data.suggest_list);
}

/* 原首页数据 */

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

      if (cards.length) {
        return cards;
      }
    } catch(e) {
      errors.push(hgErr(e));
    }
  }

  throw Error(
    errors.join("；") || "没有推荐列表"
  );
}

/* 首页仍然优先显示搜索结果 */

var home = async function() {
  var message = "";

  try {
    var cards = await hgSuggest(HG_KEYWORD);

    if (cards.length) {
      return hgResult(cards);
    }

    message = "搜索结果为空";
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
        message + "；首页：" + hgErr(e)
      )
    ]);
  }
};

/* 搜索兼容入口 */

function hgKeyword(payload) {
  if (
    typeof payload === "string" ||
    typeof payload === "number"
  ) {
    return hgS(payload).trim();
  }

  return hgS(hgPick(payload, [
    "keyword",
    "query",
    "wd",
    "text",
    "searchText",
    "searchTerm",
    "name"
  ])).trim();
}

var search = async function(payload) {
  var keyword = hgKeyword(payload);

  if (!keyword) {
    return hgResult([]);
  }

  try {
    return hgResult(
      await hgSuggest(keyword)
    );
  } catch(e) {
    return hgResult([
      hgStatus(
        "搜索失败：" + hgErr(e)
      )
    ]);
  }
};

var searchVideos = search;
var searchVideo = search;

/* 提取真实 VID */

function hgVidList(raw) {
  var arr = Array.isArray(raw)
    ? raw
    : (
        raw && typeof raw === "object"
          ? Object.values(raw)
          : []
      );

  var ids = [];
  var seen = {};

  for (var i = 0; i < arr.length; i++) {
    var entry = arr[i];

    var id =
      entry && typeof entry === "object"
        ? hgS(hgPick(entry, [
            "vid",
            "video_id",
            "videoId",
            "item_id",
            "itemId",
            "id"
          ]))
        : hgS(entry);

    if (/^\d+$/.test(id) && !seen[id]) {
      seen[id] = true;
      ids.push(id);
    }
  }

  return ids;
}

/*
 * 递归查找可能的选集字段
 * 仅收集实际存在的数字 VID
 */

function hgScanLists(obj, path, depth, results) {
  if (
    !obj ||
    typeof obj !== "object" ||
    depth > 6
  ) {
    return;
  }

  var keys = Object.keys(obj);

  for (var i = 0; i < keys.length; i++) {
    var key = keys[i];
    var value = obj[key];

    if (!value || typeof value !== "object") {
      continue;
    }

    var nextPath = path
      ? path + "." + key
      : key;

    if (
      /vid_list|video_list|episode_list|episodes|item_list|video_items|episodeList|videoList|vidList/i.test(key)
    ) {
      var ids = hgVidList(value);

      if (ids.length) {
        results.push({
          path: nextPath,
          ids: ids
        });
      }
    }

    if (depth < 6) {
      hgScanLists(
        value,
        nextPath,
        depth + 1,
        results
      );
    }
  }
}

/* 尝试详情路径 */

async function hgDetailPaths(id) {
  var urls = [
    HG_BASE + "/detail?series_id=" +
      encodeURIComponent(id),

    HG_BASE + "/detail/" +
      encodeURIComponent(id)
  ];

  var candidates = [];
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
        candidates.push({
          detail: node.seriesDetail,
          source: "详情路径" + (i + 1)
        });
      } else {
        errors.push(
          "路径" + (i + 1) + "无seriesDetail"
        );
      }
    } catch(e) {
      errors.push(
        "路径" + (i + 1) + ":" + hgErr(e)
      );
    }
  }

  return {
    candidates: candidates,
    errors: errors
  };
}

/*
 * 尝试在原首页推荐数据中
 * 查找同名、同ID的剧集
 *
 * 不将同名不同ID的剧集直接混合
 */

async function hgCheckHome(id, title) {
  var info = {
    sameId: false,
    sameTitleIds: []
  };

  try {
    var cards = await hgOriginalHome();

    for (var i = 0; i < cards.length; i++) {
      var card = cards[i];

      if (card.id === id) {
        info.sameId = true;
      }

      if (
        title &&
        card.title === title &&
        card.id !== id
      ) {
        info.sameTitleIds.push(card.id);
      }
    }
  } catch(e) {
    info.error = hgErr(e);
  }

  return info;
}

/*
 * 详情主逻辑
 * 在真实数据中选取 VID 最完整的一组
 */

var extractDetails = async function(item) {
  var id = hgId(item);

  if (!/^\d+$/.test(id)) {
    throw Error("无效 series_id");
  }

  var cached = HG_CACHE[id] || {};
  var raw = HG_RAW[id] || null;

  var sources = [];

  if (raw) {
    sources.push({
      detail: raw,
      source: "搜索数据"
    });
  }

  var detailResult = await hgDetailPaths(id);

  for (
    var i = 0;
    i < detailResult.candidates.length;
    i++
  ) {
    sources.push(
      detailResult.candidates[i]
    );
  }

  if (!sources.length) {
    throw Error(
      "没有详情数据；ID=" + id +
      "；" + detailResult.errors.join("；")
    );
  }

  var best = null;
  var stats = [];

  for (var s = 0; s < sources.length; s++) {
    var source = sources[s];
    var lists = [];

    hgScanLists(
      source.detail,
      "",
      0,
      lists
    );

    var selected = null;

    for (var j = 0; j < lists.length; j++) {
      if (
        !selected ||
        lists[j].ids.length > selected.ids.length
      ) {
        selected = lists[j];
      }
    }

    var count = selected
      ? selected.ids.length
      : 0;

    stats.push(
      source.source + ":" + count
    );

    if (
      selected &&
      (
        !best ||
        count > best.ids.length
      )
    ) {
      best = {
        detail: source.detail,
        source: source.source,
        field: selected.path,
        ids: selected.ids
      };
    }
  }

  if (!best || !best.ids.length) {
    throw Error(
      "未找到真实VID；ID=" + id +
      "；来源统计=" + stats.join(",") +
      "；详情错误=" +
      detailResult.errors.join(",")
    );
  }

  var detail = best.detail;

  var originalTitle = hgS(
    hgPick(detail, [
      "series_name",
      "series_title",
      "title"
    ]) || cached.title
  );

  var cover = hgS(
    hgPick(detail, [
      "series_cover",
      "cover"
    ]) || cached.cover
  );

  var desc = hgS(
    hgPick(detail, [
      "series_intro",
      "description",
      "intro"
    ]) || cached.description
  );

  var total = Number(
    hgPick(detail, [
      "episode_cnt",
      "episode_count",
      "total_episode_cnt",
      "total_episode_count",
      "total_episodes"
    ])
  );

  /*
   * 详情中没有总集数时，
   * 尝试读取搜索数据中的总集数。
   */

  if (
    (!Number.isFinite(total) || total <= 0) &&
    raw
  ) {
    total = Number(
      hgPick(raw, [
        "episode_cnt",
        "episode_count",
        "total_episode_cnt",
        "total_episode_count",
        "total_episodes"
      ])
    );
  }

  var known =
    Number.isFinite(total) &&
    total > 0;

  var episodes = [];

  for (var k = 0; k < best.ids.length; k++) {
    var vid = best.ids[k];

    HG_SERIES[vid] = id;

    episodes.push({
      id: vid,
      title: "第" + (k + 1) + "集",
      name: "第" + (k + 1) + "集",
      episode: k + 1,
      index: k + 1
    });
  }

  var label =
    best.ids.length +
    (known ? "/" + total : "") +
    "集·" + best.source;

  var title =
    originalTitle + " [" + label + "]";

  /*
   * 原首页核对只作诊断，
   * 不替换已验证的搜索结果ID。
   */

  var homeInfo = await hgCheckHome(
    id,
    originalTitle
  );

  if (homeInfo.sameId) {
    title += "[首页同ID]";
  } else if (homeInfo.sameTitleIds.length) {
    title += "[首页异ID]";
  }

  desc +=
    "\n选集来源：" + best.source +
    "\n选集字段：" + best.field +
    "\n已解析：" + best.ids.length +
    "\n来源统计：" + stats.join("，");

  if (known) {
    desc += "\n接口总集数：" + total;
  }

  if (homeInfo.sameTitleIds.length) {
    desc +=
      "\n首页同名ID：" +
      homeInfo.sameTitleIds.join(",");
  }

  return {
    id: id,
    title: title,
    name: title,
    cover: cover,
    description: desc,
    episodeCount: known
      ? total
      : episodes.length,
    episodes: episodes
  };
};

/*
 * 播放逻辑沿用 v0.3.1
 * 不修改请求顺序和参数
 */

async function hgWeb(seriesId, vid) {
  var router = await hgPage(
    HG_BASE +
    "/player/" +
    encodeURIComponent(seriesId) +
    "/" +
    encodeURIComponent(vid)
  );

  var page = hgFind(
    router.loaderData || {},
    function(o) {
      return !!(
        o.video_player_info ||
        o.publicVideoSeo
      );
    },
    0
  );

  if (!page) {
    throw Error("没有播放页数据");
  }

  if (
    page.vid &&
    hgS(page.vid) !== vid
  ) {
    throw Error("播放页 VID 不匹配");
  }

  if (
    page.series_id &&
    hgS(page.series_id) !== seriesId
  ) {
    throw Error("播放页 series_id 不匹配");
  }

  var url = hgMedia(
    page.video_player_info
  );

  if (url) return url;

  var seo = page.publicVideoSeo;

  if (
    seo &&
    seo.available === true &&
    hgS(seo.seriesId) === seriesId &&
    hgS(seo.itemId) === vid
  ) {
    return HG_BASE +
      "/video/public/" +
      encodeURIComponent(vid) +
      "/360p.mp4";
  }

  throw Error("没有公开媒体地址");
}

async function hgFallback(vid) {
  var data = await hgPost(
    "/api/video/protected/fallback-play-info",
    {
      item_id: vid
    }
  );

  var url = hgURL(
    data && data.main_url
  );

  if (!url) {
    throw Error("没有 main_url");
  }

  return url;
}

async function hgProtected(seriesId, vid) {
  var definitions = [
    "720p",
    "480p",
    "360p"
  ];

  var errors = [];

  for (
    var i = 0;
    i < definitions.length;
    i++
  ) {
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

      if (!info) {
        throw Error("没有 play_info");
      }

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

      if (!url) {
        throw Error("没有媒体地址");
      }

      return url;

    } catch(e) {
      errors.push(
        definition + ":" + hgErr(e)
      );
    }
  }

  throw Error(
    errors.join("；")
  );
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
      var publicURL = await hgWeb(
        seriesId,
        vid
      );

      if (publicURL) {
        return {
          url: publicURL
        };
      }
    } catch(e) {
      errors.push(
        "网页：" + hgErr(e)
      );
    }
  } else {
    errors.push("没有 series_id");
  }

  try {
    var fallbackURL = await hgFallback(vid);

    if (fallbackURL) {
      return {
        url: fallbackURL
      };
    }
  } catch(e) {
    errors.push(
      "MP4兜底：" + hgErr(e)
    );
  }

  if (seriesId) {
    try {
      var protectedURL = await hgProtected(
        seriesId,
        vid
      );

      if (protectedURL) {
        return {
          url: protectedURL
        };
      }
    } catch(e) {
      errors.push(
        "play-info：" + hgErr(e)
      );
    }
  }

  throw Error(
    "v0.3.1 播放失败；" +
    errors.join(" | ").slice(0, 650)
  );
};
