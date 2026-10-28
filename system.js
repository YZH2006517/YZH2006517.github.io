'use strict';
(()=>{
const q=s=>document.querySelector(s),qa=s=>[...document.querySelectorAll(s)];
const features={
 compose:{nodes:['context','model','showcase','scene'],kicker:'01 / 内容组织',title:'把观众的问题，变成一组恰当的展示。',body:'根据店铺资料和观众需求选择相关项目，生成临时组合；再随讲解圈出重点或展开详情。问整类时展示完整分类，问得更细时再进行挑选。',symbol:'▦'},
 sync:{nodes:['segment','tts','scene'],kicker:'02 / 核心亮点',title:'不是生成完就切，而是开口时再切。',body:'将口播与指令放进同一个 Segment，在对应句子开始播放时执行画面动作，让观众看到的内容跟上正在听的讲解。',symbol:'◎'},
 guard:{nodes:['context','human','showcase'],kicker:'03 / 可控执行',title:'模型可以给建议，规则与人保留决定权。',body:'年龄条件在生成前筛选、组合执行前复查。未知项目不切换；画面可以锁定，操作者可以人工接管，导播记录保留切换依据。',symbol:'⌑'},
 activity:{nodes:['model','activity','segment','scene'],kicker:'04 / 互动能力',title:'既是店铺掌柜，也能成为互动主持人。',body:'店铺模式围绕资料介绍内容；唠嗑模式使用独立人设和活动上下文。小游戏由 Activity 管理答案与计分，AI 负责主持、解释和串场。',symbol:'⌘'}
};
qa('[data-system-feature]').forEach(button=>button.addEventListener('click',()=>{
 const f=features[button.dataset.systemFeature];q('.system-map').classList.add('exploring');
 qa('[data-system-feature]').forEach(b=>{b.classList.toggle('selected',b===button);b.setAttribute('aria-pressed',String(b===button));});
 qa('[data-system-node]').forEach(n=>{const on=f.nodes.includes(n.dataset.systemNode);n.classList.toggle('node-active',on);n.classList.toggle('node-dim',!on);});
 q('#feature-kicker').textContent=f.kicker;q('#feature-title').textContent=f.title;q('#feature-body').textContent=f.body;q('.feature-symbol').textContent=f.symbol;
 window.siteMotion?.animate(q('.feature-explainer'),[{opacity:.3,transform:'translateY(5px)'},{opacity:1,transform:'translateY(0)'}],{duration:350});
}));
const data={
 shop:{question:'“有什么赛车项目？”',note:'已开启 AI 导播',lanes:[
 ['输入','INPUT',[['接收弹幕','过滤 / 去重 / 排队'],['读取资料','相关项目与规则'],null,null,null,['下一条输入','继续处理队列']]],
 ['决策','DECISION',[null,['构建上下文','识别赛车共同叫法'],['LLM 生成','口播 + 导播标记'],['拆分指令','关联当前轮次'],['执行前校验','名称 / 年龄 / 锁定'],null]],
 ['声音','AUDIO',[null,null,null,['TTS 合成','加入播放队列'],['Player 开口','回调 / 剩余时长'],['讲解完成','展示停留后返回']]],
 ['画面','VISUAL',[null,null,null,['等待播放','不提前切画面'],['组合与圈选','SSE 更新展示'],['停留后返回','恢复原场景']]]],
 steps:[
 ['先把弹幕安排好','输入经过去重、过滤与排队，等待当前回答的合适时机。人工接管时只记录，不自动回复。','避免回答相互打断'],
 ['用资料确定推荐的范围','识别问题里的共同叫法、分类或年龄条件，把现有项目与导播规则提供给模型。','推荐来自店铺资料'],
 ['同一段回答，包含两种内容','模型生成口播，同时插入组合、展示、圈选标记。指令不会念给观众听。','表达与动作分开'],
 ['准备声音，保留动作的关联','口播交给 TTS；合成后的语音与指令绑定在同一播放片段。此时画面继续等待。','Segment 保持关联'],
 ['一句话开口，一组动作跟上','Player 开始播放时执行该句的导播指令，执行前校验项目和条件。通过 SSE 更新卡片、圈选或详情。','同步发生在开口时'],
 ['让观众看完，再进入下一轮','总览翻页参考剩余讲解时长；讲解结束后停留，再回到原场景，继续下一条输入。','以讲解节奏驱动展示']]
 },
 chat:{question:'“C！”',note:'控制台已进入答题活动',lanes:[
 ['输入','INPUT',[['接收观众作答','当前题目已开放'],['路由给活动','不进普通问答'],null,null,null,['下一轮输入','继续游戏或聊天']]],
 ['决策','ACTIVITY',[null,['检查作答状态','是否暂停 / 已答过'],['记录答案','Activity 管理'],['判题与结算','按答案和规则处理'],['安排主持','揭晓 / 解释 / 串场'],['保存记录','轮次与参与成绩']]],
 ['声音','AUDIO',[null,null,null,['准备主持话术','TTS / 播放队列'],['播放揭晓','复用语音链路'],['回到唠嗑','恢复活动上下文']]],
 ['画面','VISUAL',[["题板已显示","活动状态同步"],null,null,['作答状态更新','SSE 事件'],['答案 / 排行榜','按游戏阶段展示'],['后续活动','游戏或唠嗑画面']]]],
 steps:[
 ['先有一场正在进行的游戏','操作者已在唠嗑模式启动答题活动，当前题目处于作答阶段。这里跟随观众的一条答案。','不把弹幕当启动指令'],
 ['把答案送到正确的处理者','识别当前游戏的作答格式，将答案交给 Activity，检查暂停状态和重复作答。','按活动状态路由'],
 ['让程序记录确定的事实','记录谁答了什么，维护参与与轮次状态。正确答案和游戏规则由程序管理。','判题不依赖模型猜测'],
 ['结算与主持各自分工','按游戏阶段处理答案和成绩，并准备揭晓、解释和串场话术；声音仍走统一播放链路。','规则执行与生成分工'],
 ['观众同时听见与看见结果','主持人揭晓答案，游戏题板或排行榜按阶段更新。画面状态通过事件同步。','复用声音与画面基础设施'],
 ['保存一场互动，接着聊下去','本场记录保留下来，再进入下一轮或回到唠嗑；不同活动使用各自上下文，减少切换串台。','互动可以持续推进']]
 }
};
let mode='shop',step=0,timer=null;
function stop(){clearTimeout(timer);timer=null;q('#journey-play').textContent='播放链路 ▶';}
function select(index){step=index;qa('[data-journey-step]').forEach((b,i)=>{b.classList.toggle('active',i===index);b.setAttribute('aria-pressed',String(i===index));});qa('.lane-cell').forEach(n=>n.classList.toggle('current',Number(n.dataset.column)===index));const s=data[mode].steps[index];q('#journey-number').textContent=`0${index+1} / 06`;q('#journey-title').textContent=s[0];q('#journey-description').textContent=s[1];q('#journey-rule').textContent=s[2];window.siteMotion?.animate(q('.journey-insight'),[{opacity:.35,transform:'translateY(5px)'},{opacity:1,transform:'translateY(0)'}],{duration:350});}
function render(){const d=data[mode];q('#journey-question').textContent=d.question;q('#journey-note').textContent=d.note;q('#journey-lanes').replaceChildren(...d.lanes.map(([label,english,cells])=>{const row=document.createElement('div');row.className='journey-lane';const name=document.createElement('div');name.className='lane-label';name.append(document.createTextNode(label));const sub=document.createElement('small');sub.textContent=english;name.append(sub);row.append(name);cells.forEach((cell,i)=>{const node=document.createElement('div');node.className='lane-cell'+(!cell?' empty':'');node.dataset.column=i;if(cell){const event=document.createElement('div');event.className='lane-event';const b=document.createElement('b'),s=document.createElement('small');b.textContent=cell[0];s.textContent=cell[1];event.append(b,s);node.append(event);}row.append(node);});return row;}));select(0);}
qa('[data-journey-mode]').forEach(button=>button.addEventListener('click',()=>{stop();mode=button.dataset.journeyMode;qa('[data-journey-mode]').forEach(b=>{b.classList.toggle('selected',b===button);b.setAttribute('aria-pressed',String(b===button));});render();}));
qa('[data-journey-step]').forEach(button=>button.addEventListener('click',()=>{stop();select(Number(button.dataset.journeyStep));}));
function advance(){timer=setTimeout(()=>{if(step===5){stop();return;}select(step+1);advance();},2200);}
q('#journey-play').addEventListener('click',()=>{if(timer){stop();return;}select(0);q('#journey-play').textContent='停止演示 Ⅱ';advance();});
document.addEventListener('visibilitychange',()=>{if(document.hidden)stop();});
render();
})();
