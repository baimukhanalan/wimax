package com.cognitivemirror.widget;

import android.app.PendingIntent;
import android.appwidget.AppWidgetManager;
import android.appwidget.AppWidgetProvider;
import android.content.Context;
import android.content.Intent;
import android.net.Uri;
import android.widget.RemoteViews;

public final class MirrorCaptureWidgetProvider extends AppWidgetProvider {
  @Override
  public void onUpdate(Context context, AppWidgetManager manager, int[] appWidgetIds) {
    for (int appWidgetId : appWidgetIds) {
      Intent capture = context.getPackageManager().getLaunchIntentForPackage(context.getPackageName());
      if (capture == null) continue;
      capture.setAction(Intent.ACTION_VIEW);
      capture.setData(Uri.parse("cognitivemirror://capture"));
      capture.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP);
      PendingIntent pending = PendingIntent.getActivity(
        context,
        appWidgetId,
        capture,
        PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
      );
      RemoteViews views = new RemoteViews(context.getPackageName(), R.layout.mirror_capture_widget);
      views.setOnClickPendingIntent(R.id.mirror_widget_root, pending);
      manager.updateAppWidget(appWidgetId, views);
    }
  }
}
