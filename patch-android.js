// Правит сгенерированный android/: разрешения, версия, иконки, цвета системных панелей, Firebase (если есть).
const fs=require('fs'),path=require('path'),cp=require('child_process');
const root=__dirname,A=path.join(root,'android','app');
const ver=(fs.readFileSync(path.join(root,'app.js'),'utf8').match(/APP_VERSION='(\d+)'/)||[])[1]||'1';
// манифест
const mp=path.join(A,'src/main/AndroidManifest.xml'); let m=fs.readFileSync(mp,'utf8');
const perms=['INTERNET','ACCESS_NETWORK_STATE','CAMERA','RECORD_AUDIO','MODIFY_AUDIO_SETTINGS','POST_NOTIFICATIONS','VIBRATE','WAKE_LOCK'];
const add=perms.filter(p=>!m.includes('android.permission.'+p+'"')).map(p=>`    <uses-permission android:name="android.permission.${p}" />`).join('\n');
m=m.replace('</manifest>',add+'\n    <uses-feature android:name="android.hardware.camera" android:required="false" />\n    <uses-feature android:name="android.hardware.microphone" android:required="false" />\n</manifest>');
fs.writeFileSync(mp,m);
// версия
const gp=path.join(A,'build.gradle'); let g=fs.readFileSync(gp,'utf8');
g=g.replace(/versionCode \d+/,'versionCode '+ver).replace(/versionName "[^"]*"/,'versionName "'+ver+'.0"'); fs.writeFileSync(gp,g);
// цвета статус-бара/навигации
const sp=path.join(A,'src/main/res/values/styles.xml'); let s=fs.readFileSync(sp,'utf8');
s=s.replace(/(<style name="AppTheme\.NoActionBar"[^>]*>)/,'$1\n        <item name="android:statusBarColor">#050914</item>\n        <item name="android:navigationBarColor">#050914</item>\n        <item name="android:windowBackground">#050914</item>'); fs.writeFileSync(sp,s);
// иконки из icon-512.png
const res=path.join(A,'src/main/res'); const sizes={mdpi:48,hdpi:72,xhdpi:96,xxhdpi:144,xxxhdpi:192};
fs.rmSync(path.join(res,'mipmap-anydpi-v26'),{recursive:true,force:true});
for(const [d,px] of Object.entries(sizes)){ const dir=path.join(res,'mipmap-'+d); fs.mkdirSync(dir,{recursive:true});
  for(const n of ['ic_launcher','ic_launcher_round','ic_launcher_foreground']) cp.execFileSync('convert',[path.join(root,'icon-512.png'),'-resize',px+'x'+px,path.join(dir,n+'.png')]); }
// Firebase (push): положи google-services.json в корень репозитория или передай секретом в CI
const gs=path.join(root,'google-services.json'); if(fs.existsSync(gs)) fs.copyFileSync(gs,path.join(A,'google-services.json'));
console.log('android patched, version',ver);
