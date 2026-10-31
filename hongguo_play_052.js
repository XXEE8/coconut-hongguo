/* Coconut 红果短剧 v0.5.2：首页完整选集与搜索双源合并，无登录 */
var HG_BASE="https://hongguoduanju.com";
var HG_UA="Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36";
var HG_SERIES={},HG_CACHE={},HG_RAW={},HG_ORIGIN={},HG_KEYWORD="归路";
function hgS(v){return v==null?"":String(v)}
function hgPick(o,keys){if(!o||typeof o!=="object")return "";for(var i=0;i<keys.length;i++){var v=o[keys[i]];if(v!==undefined&&v!==null&&v!=="")return v}return ""}
function hgErr(e){return hgS(e&&e.message?e.message:e)}
function hgHeaders(json){var h={"Accept":json?"application/json":"text/html,application/xhtml+xml","Referer":HG_BASE+"/","User-Agent":HG_UA};if(json)h["Content-Type"]="application/json";return h}
async function hgRequest(url,opt){var r=await fetch(url,opt||{method:"GET",headers:hgHeaders(false)});if(!r.ok)throw Error("HTTP "+r.status);return r}
function hgParse(html){var pos=html.indexOf("_ROUTER_DATA");if(pos<0)throw Error("缺少 _ROUTER_DATA");var start=html.indexOf("{",pos);if(start<0)throw Error("缺少 JSON");var depth=0,quoted=false,escaped=false;for(var i=start;i<html.length;i++){var c=html[i];if(quoted){if(escaped)escaped=false;else if(c==="\\")escaped=true;else if(c==='"')quoted=false}else if(c==='"')quoted=true;else if(c==="{")depth++;else if(c==="}"){depth--;if(depth===0)return JSON.parse(html.slice(start,i+1))}}throw Error("路由 JSON 不完整")}
async function hgPage(url){return hgParse(await(await hgRequest(url)).text())}
async function hgPost(path,body){return await(await hgRequest(HG_BASE+path,{method:"POST",headers:hgHeaders(true),body:JSON.stringify(body)})).json()}
function hgFind(obj,fn,depth){if(!obj||typeof obj!=="object"||depth>8)return null;if(fn(obj))return obj;var keys=Object.keys(obj);for(var i=0;i<keys.length;i++){if(/^(req|request|headers)$/.test(keys[i]))continue;var found=hgFind(obj[keys[i]],fn,depth+1);if(found)return found}return null}
function hgId(item){return typeof item==="string"||typeof item==="number"?hgS(item):hgS(hgPick(item,["id","vid","video_id","videoId","series_id","seriesId"]))}
function hgURL(v){if(typeof v!=="string")return "";v=v.trim();if(v.indexOf("//")===0)v="https:"+v;return /^https?:\/\/\S+$/i.test(v)?v:""}
function hgMedia(info){if(!info)return "";if(typeof info==="string")return hgURL(info);var fields=["main_url","backup_url","backup_url_1","play_url","video_url","url"];for(var i=0;i<fields.length;i++){var v=info[fields[i]];if(typeof v==="string"){var url=hgURL(v);if(url)return url}if(v&&typeof v==="object"){var nested=hgURL(v.main_url||v.url);if(nested)return nested}}return ""}
function hgResult(cards){return {list:cards,items:cards,videos:cards}}
function hgCard(entry){if(!entry||typeof entry!=="object")return null;var v=entry.video_data||entry.videoData||entry;var id=hgS(hgPick(v,["series_id","seriesId","book_id"]));if(!/^\d+$/.test(id))return null;var title=hgS(hgPick(v,["series_name","series_title","seriesName","title","name"])||entry.name||(entry.display_words&&entry.display_words[0]));var card={id:id,title:title||"未命名短剧",name:title||"未命名短剧",cover:hgS(hgPick(v,["series_cover","seriesCover","cover","cover_url"])),description:hgS(hgPick(v,["series_intro","description","intro"]))};HG_CACHE[id]=card;HG_RAW[id]=v;return card}
function hgCards(raw){var cards=[],seen={};for(var i=0;i<raw.length;i++){var card=hgCard(raw[i]);if(card&&!seen[card.id]){seen[card.id]=true;cards.push(card)}}return cards}
function hgStatus(msg){return {id:"diag052",title:"诊断："+msg,name:"诊断："+msg,cover:"",description:msg}}
async function hgSuggest(keyword){keyword=hgS(keyword).trim();if(!keyword)return [];var url=HG_BASE+"/incent_resource/suggestion?app_id=8662&query="+encodeURIComponent(keyword)+"&count=20";var r=await hgRequest(url,{method:"GET",headers:{"Accept":"application/json, text/plain, */*","Referer":HG_BASE+"/","User-Agent":HG_UA}});var data=await r.json();if(!Array.isArray(data&&data.suggest_list))throw Error("没有 suggest_list");return hgCards(data.suggest_list)}
async function hgOriginalHome(){
 var urls=[HG_BASE+"/category/real-drama?page=1",HG_BASE+"/category?tab=1&sort_type=1"],errors=[];
 for(var i=0;i<urls.length;i++){
  try{
   var router=await hgPage(urls[i]);
   var node=hgFind(router.loaderData||{},function(o){return Array.isArray(o.recommendList)&&o.recommendList.length>0},0);
   if(!node)continue;
   var cards=hgCards(node.recommendList);
   if(cards.length){for(var j=0;j<cards.length;j++)HG_ORIGIN[cards[j].id]="首页";return cards}
  }catch(e){errors.push(hgErr(e))}
 }
 throw Error(errors.join("；")||"首页无推荐列表");
}
var home=async function(){
 try{return hgResult(await hgOriginalHome())}
 catch(e){try{return hgResult(await hgSuggest(HG_KEYWORD))}catch(x){return hgResult([hgStatus("首页:"+hgErr(e)+"；搜索:"+hgErr(x))])}}
};
function hgKeyword(payload){return typeof payload==="string"||typeof payload==="number"?hgS(payload).trim():hgS(hgPick(payload,["keyword","query","wd","text","searchText","searchTerm","name"])).trim()}
function hgNorm(v){return hgS(v).replace(/[\s\[\]【】（）()·:：-]/g,"").toLowerCase()}
var search=async function(payload){
 var keyword=hgKeyword(payload);if(!keyword)return hgResult([]);
 var found=[],errors=[];
 try{found=await hgSuggest(keyword)}catch(e){errors.push("搜索:"+hgErr(e))}
 var result=[],seen={};
 for(var i=0;i<found.length;i++){var c=found[i];if(!seen[c.id]){result.push(c);seen[c.id]=true}}
 try{
  var original=await hgOriginalHome();
  for(var j=0;j<original.length;j++){
   var h=original[j],name=hgNorm(h.title),q=hgNorm(keyword);
   if(!name||!q||name.indexOf(q)<0||seen[h.id])continue;
   var alternative={id:h.id,title:h.title+" [首页版·完整选集优先]",name:h.name+" [首页版]",cover:h.cover,description:h.description};
   result.push(alternative);seen[h.id]=true;
  }
 }catch(e){errors.push("首页:"+hgErr(e))}
 if(!result.length)return hgResult([hgStatus(errors.join("；")||"没有搜索结果")]);
 return hgResult(result);
};
var searchVideos=search,searchVideo=search;
function hgVidList(raw){var arr=Array.isArray(raw)?raw:(raw&&typeof raw==="object"?Object.values(raw):[]),ids=[],seen={};for(var i=0;i<arr.length;i++){var entry=arr[i];var id=entry&&typeof entry==="object"?hgS(hgPick(entry,["vid","video_id","videoId","item_id","itemId","id"])):hgS(entry);if(/^\d+$/.test(id)&&!seen[id]){seen[id]=true;ids.push(id)}}return ids}
function hgCandidates(detail){var keys=["vid_list","video_list","episode_list","episodes","item_list","video_items","episodeList","videoList","vidList"],best=null;for(var i=0;i<keys.length;i++){var value=detail&&detail[keys[i]];if(value&&typeof value==="object"){var ids=hgVidList(value);if(ids.length&&(!best||ids.length>best.ids.length))best={ids:ids,field:keys[i]}}}return best}
async function hgGetOfficial(id){var paths=[HG_BASE+"/detail?series_id="+encodeURIComponent(id),HG_BASE+"/detail/"+encodeURIComponent(id)],errors=[];for(var i=0;i<paths.length;i++){try{var router=await hgPage(paths[i]);var data=router.loaderData||{};var node=data.detail_page||data["detail_$"]||hgFind(data,function(o){return !!(o.seriesDetail&&typeof o.seriesDetail==="object")},0);var detail=node&&node.seriesDetail;if(!detail)throw Error("没有seriesDetail");var returned=hgS(hgPick(detail,["series_id","seriesId"]));if(returned&&returned!==id)throw Error("series_id不匹配");var list=hgCandidates(detail);if(list&&list.ids.length)return {detail:detail,list:list,source:"官网详情"+(i+1)};errors.push("路径"+(i+1)+"无有效VID")}catch(e){errors.push("路径"+(i+1)+":"+hgErr(e))}}return {error:errors.join("；")}}
/* 双源详情：以实际选中ID为准，不混用不同剧集ID */
var extractDetails=async function(item){
 var id=hgId(item);if(!/^\d+$/.test(id))throw Error("无效 series_id");
 var raw=HG_RAW[id]||{},cached=HG_CACHE[id]||{},fallback=hgCandidates(raw);
 var official=await hgGetOfficial(id),best=fallback,detail=raw,source="搜索数据";
 if(official.list&&(!best||official.list.ids.length>best.ids.length)){
  best=official.list;detail=official.detail;source="官网详情";
 }
 if(!best||!best.ids.length)throw Error("无有效VID；"+(official.error||"无选集"));
 var title=hgS(hgPick(detail,["series_name","series_title","title"])||cached.title);
 var cover=hgS(hgPick(detail,["series_cover","cover"])||cached.cover);
 var desc=hgS(hgPick(detail,["series_intro","description","intro"])||cached.description);
 var total=Number(hgPick(detail,["episode_cnt","episode_count","total_episode_cnt","total_episode_count","total_episodes"])||hgPick(raw,["episode_cnt","episode_count","total_episode_cnt","total_episode_count","total_episodes"]));
 var known=Number.isFinite(total)&&total>0,episodes=[];
 for(var i=0;i<best.ids.length;i++){
  var vid=best.ids[i];HG_SERIES[vid]=id;
  episodes.push({id:vid,title:"第"+(i+1)+"集",name:"第"+(i+1)+"集",episode:i+1,index:i+1});
 }
 title+=" ["+source+"·"+episodes.length+(known?"/"+total:"")+"集]";
 desc+="\n实际选集来源："+source+"\n当前剧集ID："+id;
 if(official.error)desc+="\n详情诊断："+official.error;
 return {id:id,title:title,name:title,cover:cover,description:desc,episodeCount:known?total:episodes.length,episodes:episodes};
};
/* 已验证的 v0.3.1 播放逻辑：不修改 */
async function hgWeb(seriesId,vid){var router=await hgPage(HG_BASE+"/player/"+encodeURIComponent(seriesId)+"/"+encodeURIComponent(vid));var page=hgFind(router.loaderData||{},function(o){return !!(o.video_player_info||o.publicVideoSeo)},0);if(!page)throw Error("没有播放页数据");if(page.vid&&hgS(page.vid)!==vid)throw Error("播放页 VID 不匹配");if(page.series_id&&hgS(page.series_id)!==seriesId)throw Error("播放页 series_id 不匹配");var url=hgMedia(page.video_player_info);if(url)return url;var seo=page.publicVideoSeo;if(seo&&seo.available===true&&hgS(seo.seriesId)===seriesId&&hgS(seo.itemId)===vid)return HG_BASE+"/video/public/"+encodeURIComponent(vid)+"/360p.mp4";throw Error("没有公开媒体地址")}
async function hgFallback(vid){var data=await hgPost("/api/video/protected/fallback-play-info",{item_id:vid});var url=hgURL(data&&data.main_url);if(!url)throw Error("没有 main_url");return url}
async function hgProtected(seriesId,vid){var definitions=["720p","480p","360p"],errors=[];for(var i=0;i<definitions.length;i++){var definition=definitions[i];try{var data=await hgPost("/api/video/protected/play-info",{series_id:seriesId,item_id:vid,definition:definition});var info=data&&data.play_info;if(!info)throw Error("没有 play_info");var key=hgS(info.player_access_key).trim();if(info.encrypted===true||info.is_encrypted===true||info.drm||info.decryption||/^[0-9a-fA-F]{32}$/.test(key))throw Error("需要额外解密，当前模块不支持");var url=hgMedia(info);if(!url)throw Error("没有媒体地址");return url}catch(e){errors.push(definition+":"+hgErr(e))}}throw Error(errors.join("；"))}
var extractStreamUrl=async function(input){var vid=hgId(input);if(!/^\d+$/.test(vid))throw Error("v0.3.1：无效 VID");var seriesId=HG_SERIES[vid]||"",errors=[];if(seriesId){try{var publicURL=await hgWeb(seriesId,vid);if(publicURL)return {url:publicURL}}catch(e){errors.push("网页："+hgErr(e))}}else errors.push("没有 series_id");try{var fallbackURL=await hgFallback(vid);if(fallbackURL)return {url:fallbackURL}}catch(e){errors.push("MP4兜底："+hgErr(e))}if(seriesId){try{var protectedURL=await hgProtected(seriesId,vid);if(protectedURL)return {url:protectedURL}}catch(e){errors.push("play-info："+hgErr(e))}}throw Error("v0.3.1 播放失败；"+errors.join(" | ").slice(0,650))};
