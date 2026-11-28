var JAVA_MAIN=String.raw`package app.kotak.messenger;

import android.content.Intent;
import android.os.Bundle;
import android.view.WindowManager;
import android.webkit.JavascriptInterface;
import androidx.core.app.NotificationManagerCompat;
import com.getcapacitor.BridgeActivity;
import org.json.JSONObject;

public class MainActivity extends BridgeActivity {
  static volatile boolean foreground = false;
  static volatile String pending = "";

  @Override public void onCreate(Bundle b) {
    super.onCreate(b);
    getBridge().getWebView().addJavascriptInterface(new Object() {
      @JavascriptInterface public String takeIntent() { String s = pending; pending = ""; return s; }
    }, "KotakNative");
    handle(getIntent());
  }

  @Override protected void onNewIntent(Intent i) { super.onNewIntent(i); setIntent(i); handle(i); }
  @Override public void onStart() { super.onStart(); foreground = true; }
  @Override public void onStop() { super.onStop(); foreground = false; }

  @SuppressWarnings("deprecation")
  private void handle(Intent i) {
    if (i == null || !i.hasExtra("kotak_type")) return;
    try {
      JSONObject o = new JSONObject();
      o.put("type", i.getStringExtra("kotak_type")).put("action", i.getStringExtra("kotak_action"));
      for (String k : new String[]{"cid", "from", "kind", "name", "conv"}) o.put(k, i.getStringExtra("kotak_" + k));
      pending = o.toString();
      if ("call".equals(i.getStringExtra("kotak_type"))) {
        String cid = i.getStringExtra("kotak_cid");
        if (cid != null) NotificationManagerCompat.from(this).cancel(cid.hashCode());
        getWindow().addFlags(WindowManager.LayoutParams.FLAG_SHOW_WHEN_LOCKED | WindowManager.LayoutParams.FLAG_TURN_SCREEN_ON | WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
      }
      for (String k : new String[]{"kotak_type", "kotak_action"}) i.removeExtra(k);
      getBridge().getWebView().postDelayed(() -> getBridge().getWebView().evaluateJavascript("window.dispatchEvent(new Event('kotak-intent'))", null), 400);
    } catch (Exception e) { /* ignore */ }
  }
}
`;
var JAVA_SVC=String.raw`package app.kotak.messenger;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.media.AudioAttributes;
import android.media.RingtoneManager;
import android.net.Uri;
import android.os.Build;
import androidx.core.app.NotificationCompat;
import androidx.core.app.NotificationManagerCompat;
import com.google.firebase.messaging.FirebaseMessagingService;
import com.google.firebase.messaging.RemoteMessage;
import java.util.Map;

/** Принимает data-push: call / call_end / msg. Если приложение на экране — ничего не делает (JS сам получает всё по Realtime). */
public class KotakMessagingService extends FirebaseMessagingService {
  static final String CH_CALLS = "calls_v1", CH_MSG = "messages_v1";

  @Override public void onNewToken(String token) { /* токен отправляет JS при запуске (register) */ }

  @Override public void onMessageReceived(RemoteMessage m) {
    Map<String, String> d = m.getData();
    String type = d.get("type");
    if (type == null) return;
    try {
      channels();
      if ("call_end".equals(type)) { NotificationManagerCompat.from(this).cancel(idOf(d.get("cid"))); return; }
      if (MainActivity.foreground) return;
      if ("call".equals(type)) showCall(d); else if ("msg".equals(type)) showMsg(d);
    } catch (Throwable t) { /* не роняем сервис */ }
  }

  private static int idOf(String s) { return s == null ? 1 : s.hashCode(); }

  private void channels() {
    if (Build.VERSION.SDK_INT < 26) return;
    NotificationManager nm = getSystemService(NotificationManager.class);
    if (nm.getNotificationChannel(CH_CALLS) == null) {
      NotificationChannel c = new NotificationChannel(CH_CALLS, "Звонки", NotificationManager.IMPORTANCE_HIGH);
      Uri ring = RingtoneManager.getDefaultUri(RingtoneManager.TYPE_RINGTONE);
      c.setSound(ring, new AudioAttributes.Builder().setUsage(AudioAttributes.USAGE_NOTIFICATION_RINGTONE).setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION).build());
      c.enableVibration(true); c.setVibrationPattern(new long[]{0, 700, 500, 700, 500});
      c.setLockscreenVisibility(Notification.VISIBILITY_PUBLIC);
      nm.createNotificationChannel(c);
    }
    if (nm.getNotificationChannel(CH_MSG) == null) {
      NotificationChannel c = new NotificationChannel(CH_MSG, "Сообщения", NotificationManager.IMPORTANCE_HIGH);
      c.enableVibration(true);
      nm.createNotificationChannel(c);
    }
  }

  private PendingIntent open(Map<String, String> d, String action, int req) {
    Intent i = new Intent(this, MainActivity.class).setAction("kotak." + action + "." + req)
        .setFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_SINGLE_TOP | Intent.FLAG_ACTIVITY_CLEAR_TOP);
    i.putExtra("kotak_type", d.get("type")).putExtra("kotak_action", action);
    for (String k : new String[]{"cid", "from", "kind", "name", "conv"}) if (d.get(k) != null) i.putExtra("kotak_" + k, d.get(k));
    return PendingIntent.getActivity(this, req, i, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
  }

  private void showCall(Map<String, String> d) {
    int id = idOf(d.get("cid"));
    String name = d.get("name") != null ? d.get("name") : "KotakApp";
    String text = d.get("body") != null ? d.get("body") : ("video".equals(d.get("kind")) ? "Входящий видеозвонок" : "Входящий звонок");
    NotificationCompat.Builder b = new NotificationCompat.Builder(this, CH_CALLS)
        .setSmallIcon(android.R.drawable.sym_call_incoming)
        .setContentTitle(name).setContentText(text)
        .setPriority(NotificationCompat.PRIORITY_MAX).setCategory(NotificationCompat.CATEGORY_CALL)
        .setVisibility(NotificationCompat.VISIBILITY_PUBLIC)
        .setOngoing(true).setAutoCancel(true).setTimeoutAfter(45000)
        .setSound(RingtoneManager.getDefaultUri(RingtoneManager.TYPE_RINGTONE))
        .setContentIntent(open(d, "open", id))
        .setFullScreenIntent(open(d, "open", id + 1), true)
        .addAction(android.R.drawable.ic_menu_close_clear_cancel, d.get("decline") != null ? d.get("decline") : "Отклонить", open(d, "decline", id + 2))
        .addAction(android.R.drawable.sym_action_call, d.get("accept") != null ? d.get("accept") : "Принять", open(d, "accept", id + 3));
    Notification n = b.build();
    n.flags |= Notification.FLAG_INSISTENT; // рингтон повторяется до ответа/таймаута
    NotificationManagerCompat nm = NotificationManagerCompat.from(this);
    if (nm.areNotificationsEnabled()) nm.notify(id, n);
  }

  private void showMsg(Map<String, String> d) {
    int id = idOf(d.get("conv"));
    NotificationCompat.Builder b = new NotificationCompat.Builder(this, CH_MSG)
        .setSmallIcon(android.R.drawable.stat_notify_chat)
        .setContentTitle(d.get("title") != null ? d.get("title") : "KotakApp").setContentText(d.get("body"))
        .setStyle(new NotificationCompat.BigTextStyle().bigText(d.get("body")))
        .setPriority(NotificationCompat.PRIORITY_HIGH).setCategory(NotificationCompat.CATEGORY_MESSAGE)
        .setAutoCancel(true).setDefaults(NotificationCompat.DEFAULT_ALL)
        .setContentIntent(open(d, "open", id));
    NotificationManagerCompat nm = NotificationManagerCompat.from(this);
    if (nm.areNotificationsEnabled()) nm.notify(id, b.build());
  }
}
`;

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
  for(const n of ['ic_launcher','ic_launcher_round','ic_launcher_foreground']){ const dst=path.join(dir,n+'.png'); let ok=false;
    for(const bin of ['magick','convert']){ if(ok) break; try{ cp.execFileSync(bin,[path.join(root,'icon-512.png'),'-resize',px+'x'+px,dst],{stdio:'ignore'}); ok=true; }catch(e){} }
    if(!ok) fs.copyFileSync(path.join(root,px>96?'icon-192.png':'icon-192.png'),dst); } }

// ---- v27: нативные push (звонок на экране блокировки, сообщения) ----
const jd=path.join(A,'src/main/java/app/kotak/messenger'); fs.mkdirSync(jd,{recursive:true});
fs.writeFileSync(path.join(jd,'MainActivity.java'),JAVA_MAIN); fs.writeFileSync(path.join(jd,'KotakMessagingService.java'),JAVA_SVC);
let m2=fs.readFileSync(mp,'utf8');
if(!m2.includes('xmlns:tools')) m2=m2.replace('<manifest ','<manifest xmlns:tools="http://schemas.android.com/tools" ');
if(!m2.includes('USE_FULL_SCREEN_INTENT')) m2=m2.replace('</manifest>','    <uses-permission android:name="android.permission.USE_FULL_SCREEN_INTENT" />\n</manifest>');
if(!m2.includes('KotakMessagingService')) m2=m2.replace('</application>','    <service android:name=".KotakMessagingService" android:exported="false"><intent-filter android:priority="100"><action android:name="com.google.firebase.MESSAGING_EVENT" /></intent-filter></service>\n    <service android:name="com.capacitorjs.plugins.pushnotifications.MessagingService" tools:node="remove" />\n</application>');
fs.writeFileSync(mp,m2);
let g2=fs.readFileSync(gp,'utf8');
if(!g2.includes('firebase-messaging')) g2=g2.replace(/dependencies\s*\{/,"dependencies {\n    implementation 'com.google.firebase:firebase-messaging:23.4.1'"); fs.writeFileSync(gp,g2);
// Firebase (push): положи google-services.json в корень репозитория или передай секретом в CI
const gs=path.join(root,'google-services.json'); if(fs.existsSync(gs)) fs.copyFileSync(gs,path.join(A,'google-services.json'));
console.log('android patched, version',ver);
