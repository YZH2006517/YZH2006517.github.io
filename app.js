'use strict';
(() => {
 const root=document.documentElement;
 const languageButton=document.querySelector('#language'),themeButton=document.querySelector('#theme'),copyButton=document.querySelector('#copy-email'),status=document.querySelector('#copy-status');
 const reduceMotion=matchMedia('(prefers-reduced-motion: reduce)'),systemDark=matchMedia('(prefers-color-scheme: dark)');
 const read=key=>{try{return localStorage.getItem(key);}catch{return null;}},save=(key,value)=>{try{localStorage.setItem(key,value);}catch{}};
 const nodes=[...document.querySelectorAll('[data-en]')].map(node=>({node,zh:node.innerHTML,en:node.dataset.en}));
 const labels=[...document.querySelectorAll('[data-en-label]')].map(node=>{const attr=node.tagName==='META'?'content':'aria-label';return{node,attr,zh:node.getAttribute(attr),en:node.dataset.enLabel};});
 const isEnglish=()=>root.lang==='en',isDark=()=>root.dataset.theme?root.dataset.theme==='dark':systemDark.matches;
 function updateThemeLabel(){themeButton.setAttribute('aria-label',isEnglish()?`Switch to ${isDark()?'light':'dark'} appearance`:`切换${isDark()?'浅色':'深色'}外观`);document.querySelector('meta[name="theme-color"]').content=isDark()?'#191b1a':'#f5f3ee';}
 function setLanguage(language){
  const en=language==='en';
  for(const item of nodes){if(en)item.node.textContent=item.en;else item.node.innerHTML=item.zh;}
  for(const item of labels)item.node.setAttribute(item.attr,en?item.en:item.zh);
  root.lang=en?'en':'zh-CN';languageButton.textContent=en?'中':'EN';languageButton.setAttribute('aria-label',en?'切换到中文':'Switch to English');
  document.querySelector('.site-header .brand').setAttribute('aria-label',en?'NANATATA home':'NANATATA 首页');status.textContent='';updateThemeLabel();save('nanatata-lang',en?'en':'zh');
 }
 const savedTheme=read('nanatata-theme');if(savedTheme==='light'||savedTheme==='dark')root.dataset.theme=savedTheme;
 setLanguage(read('nanatata-lang')==='en'?'en':'zh');languageButton.hidden=themeButton.hidden=copyButton.hidden=false;document.querySelector('#year').textContent=String(new Date().getFullYear());
 languageButton.addEventListener('click',()=>setLanguage(isEnglish()?'zh':'en'));
 themeButton.addEventListener('click',()=>{root.dataset.theme=isDark()?'light':'dark';save('nanatata-theme',root.dataset.theme);updateThemeLabel();});systemDark.addEventListener('change',updateThemeLabel);
 copyButton.addEventListener('click',async()=>{try{if(!navigator.clipboard?.writeText)throw Error('unavailable');await navigator.clipboard.writeText('zhenhao897@gmail.com');status.textContent=isEnglish()?'Email copied.':'邮箱已复制。';}catch{status.textContent=isEnglish()?'Please select and copy the email above, or click it to open your mail app.':'请选中上方邮箱复制，或点击邮箱打开邮件应用。';}});
 function openLinkedProject(){const aliases={'#architecture':'#streamer','#runtime':'#streamer','#concept':'#streamer'};const hash=aliases[location.hash]||location.hash;const project=[...document.querySelectorAll('details.project')].find(item=>`#${item.id}`===hash);if(!project)return;project.open=true;if(location.hash==='#concept')project.querySelector('.video-disclosure').open=true;requestAnimationFrame(()=>project.scrollIntoView({behavior:'instant',block:'start'}));}
 openLinkedProject();addEventListener('hashchange',openLinkedProject);
 document.querySelectorAll('details').forEach(disclosure=>disclosure.addEventListener('toggle',()=>{if(!disclosure.open)disclosure.querySelectorAll('video').forEach(video=>video.pause());}));
 // Reading never depends on animations or IntersectionObserver support.
 if('IntersectionObserver'in window&&!reduceMotion.matches){const observer=new IntersectionObserver(entries=>{for(const entry of entries){if(!entry.isIntersecting)continue;if(!reduceMotion.matches&&typeof entry.target.animate==='function')entry.target.animate([{opacity:.25,transform:'translateY(18px)'},{opacity:1,transform:'translateY(0)'}],{duration:600,easing:'cubic-bezier(.2,.7,.2,1)'});observer.unobserve(entry.target);}},{threshold:.12});document.querySelectorAll('.about-body,.work-heading,.project,.contact-body').forEach(el=>observer.observe(el));}
})();
