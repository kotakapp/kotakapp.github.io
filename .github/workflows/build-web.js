// Копирует веб-файлы в www/ для Capacitor и кладёт supabase-js локально (APK работает без CDN).
const fs=require('fs'),path=require('path');
const root=__dirname,out=path.join(root,'www');
fs.rmSync(out,{recursive:true,force:true}); fs.mkdirSync(out);
const files=fs.readdirSync(root).filter(f=>/\.(html|css|js|png|ico|webmanifest)$/.test(f)&&!['build-web.js','patch-android.js'].includes(f));
files.forEach(f=>fs.copyFileSync(path.join(root,f),path.join(out,f)));
const umd=path.join(root,'node_modules/@supabase/supabase-js/dist/umd/supabase.js');
if(!fs.existsSync(umd)) throw new Error('supabase.js не найден: выполни npm install');
fs.copyFileSync(umd,path.join(out,'supabase.js'));
const ip=path.join(out,'index.html'); let h=fs.readFileSync(ip,'utf8');
if(!h.includes("var cdn=[")) throw new Error('index.html: не найден список CDN');
h=h.replace("var cdn=[","var cdn=[['local','supabase.js'],"); fs.writeFileSync(ip,h);
console.log('www: '+files.length+' файлов + supabase.js');
