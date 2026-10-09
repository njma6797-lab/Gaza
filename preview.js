window.NegmPreview = (() => {
  function show(){NegmEditor.sync();const files=NegmEditor.all();const html=files.get('index.html')||files.get('index.htm')||'<h1>أنشئ index.html للمعاينة</h1>';const frame=document.getElementById('previewFrame');frame.srcdoc=html;document.getElementById('previewPanel').classList.add('visible');document.getElementById('previewPanel').scrollIntoView({behavior:'smooth',block:'start'});}
  function hide(){document.getElementById('previewPanel').classList.remove('visible');}
  return {show,hide};
})();
