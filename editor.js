window.NegmEditor = (() => {
  const files = new Map(); let active = 'index.html';
  const starter = '<!doctype html>\n<html lang="ar" dir="rtl">\n<head>\n  <meta charset="utf-8">\n  <meta name="viewport" content="width=device-width,initial-scale=1">\n  <title>مشروعي الأول</title>\n  <style>body{font-family:Arial,sans-serif;padding:2rem;background:#f5f7fb;color:#172033}</style>\n</head>\n<body>\n  <h1>أهلًا بك في مشروعي</h1>\n  <p>ابدأ تعديل الكود من NEGM CODE LAB.</p>\n</body>\n</html>\n';
  function init(){ files.set('index.html',starter); renderTree(); select('index.html'); }
  function renderTree(){ const tree=document.getElementById('fileTree'); tree.innerHTML=''; [...files.keys()].sort().forEach(path=>{const b=document.createElement('button');b.className='file-item'+(path===active?' selected':'');b.textContent=(path.includes('.')?'▤ ':'▱ ')+path;b.dataset.file=path;b.addEventListener('click',()=>select(path));tree.appendChild(b);}); }
  function select(path){ if(!files.has(path))return; sync(); active=path; document.getElementById('codeEditor').value=files.get(path); document.getElementById('activeFileName').textContent=path; renderTree(); lineInfo(); }
  function sync(){const editor=document.getElementById('codeEditor');if(editor&&active)files.set(active,editor.value);}
  function add(path,content=''){path=path.trim().replace(/^\/+/, '');if(!path||path.split('/').some(x=>x==='..'))throw new Error('اسم الملف غير صالح.');files.set(path,content);select(path);return path;}
  function removeActive(){if(files.size<=1)throw new Error('لا يمكن حذف آخر ملف.');files.delete(active);active=[...files.keys()][0];select(active);}
  function addUploads(list){return Promise.all([...list].map(file=>new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>{const data=String(reader.result);if(file.type.startsWith('text/')||/\.(html|css|js|json|md|xml|svg|txt|yml|yaml)$/i.test(file.name)){add(file.name,data);}else{files.set(file.name,data);renderTree();}resolve(file.name);};reader.onerror=()=>reject(new Error('تعذرت قراءة '+file.name));reader.readAsDataURL(file);})));}
  function all(){sync();return new Map(files);} function get(path){sync();return files.get(path);} function activeFile(){return active;}
  function setContent(path,content){if(!files.has(path))files.set(path,content);select(path);}
  function lineInfo(){const value=document.getElementById('codeEditor').value;document.getElementById('lineInfo').textContent='سطر '+(value.slice(0,document.getElementById('codeEditor').selectionStart).split('\n').length);}
  return {init,add,removeActive,addUploads,all,get,activeFile,setContent,sync,lineInfo};
})();
