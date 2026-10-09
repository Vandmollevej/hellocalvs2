// "Rediger widget" screen for Hurtig-tilføj (choose up to 5 buttons) and
// Statistik-boks (choose one box). Opened by the launcher when the widget is
// placed or reconfigured; the options come from the cached snapshot.
package dk.packroff.hellocal.widgets

import android.appwidget.AppWidgetManager
import android.content.Intent
import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.Checkbox
import androidx.compose.material3.RadioButton
import androidx.compose.material3.Text
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateListOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.glance.appwidget.GlanceAppWidgetManager
import androidx.lifecycle.lifecycleScope
import kotlinx.coroutines.launch

class WidgetConfigActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        val appWidgetId = intent?.extras?.getInt(AppWidgetManager.EXTRA_APPWIDGET_ID, AppWidgetManager.INVALID_APPWIDGET_ID)
            ?: AppWidgetManager.INVALID_APPWIDGET_ID
        setResult(RESULT_CANCELED, Intent().putExtra(AppWidgetManager.EXTRA_APPWIDGET_ID, appWidgetId))
        if (appWidgetId == AppWidgetManager.INVALID_APPWIDGET_ID) return finish()

        val provider = AppWidgetManager.getInstance(this).getAppWidgetInfo(appWidgetId)?.provider?.className
        val snapshot = SnapshotRepository.cached(this)
        val isStatBox = provider == StatBoxWidgetReceiver::class.java.name

        setContent {
            Column(
                modifier = Modifier.fillMaxSize().background(HcColors.Page).padding(16.dp),
                verticalArrangement = Arrangement.spacedBy(16.dp),
            ) {
                Text(
                    if (isStatBox) "Vælg statistik-boks" else "Vælg op til $MAX_ADD_ROW_ACTIONS knapper",
                    fontSize = 20.sp,
                    fontWeight = FontWeight.Bold,
                    color = HcColors.Action,
                )
                if (snapshot == null) {
                    Text("Åbn Hello Cal og log ind først.", fontSize = 15.sp, color = HcColors.TextSecondary)
                    return@Column
                }
                if (isStatBox) {
                    var selected by remember { mutableStateOf(WidgetChoices.statBoxKey(this@WidgetConfigActivity, appWidgetId)) }
                    LazyColumn(modifier = Modifier.weight(1f)) {
                        items(snapshot.statBoxes) { box ->
                            Row(
                                modifier = Modifier.fillMaxWidth().height(48.dp).clickable { selected = box.key },
                                verticalAlignment = Alignment.CenterVertically,
                            ) {
                                RadioButton(selected = selected == box.key, onClick = { selected = box.key })
                                Text(box.label, fontSize = 17.sp, color = HcColors.Action, modifier = Modifier.weight(1f))
                                Text(box.value, fontSize = 13.sp, color = HcColors.TextSecondary)
                            }
                        }
                    }
                    SaveButton { WidgetChoices.setStatBoxKey(this@WidgetConfigActivity, appWidgetId, selected); done(appWidgetId) }
                } else {
                    val selected = remember {
                        mutableStateListOf<String>().apply { addAll(WidgetChoices.addRowKeys(this@WidgetConfigActivity, appWidgetId)) }
                    }
                    LazyColumn(modifier = Modifier.weight(1f)) {
                        items(snapshot.addActions) { action ->
                            val checked = action.key in selected
                            val toggle = {
                                if (checked) selected.remove(action.key)
                                else if (selected.size < MAX_ADD_ROW_ACTIONS) selected.add(action.key)
                            }
                            Row(
                                modifier = Modifier.fillMaxWidth().height(48.dp).clickable { toggle() },
                                verticalAlignment = Alignment.CenterVertically,
                            ) {
                                Checkbox(checked = checked, onCheckedChange = { toggle() })
                                Text(action.label, fontSize = 17.sp, color = HcColors.Action)
                            }
                        }
                    }
                    SaveButton { WidgetChoices.setAddRowKeys(this@WidgetConfigActivity, appWidgetId, selected.toList()); done(appWidgetId) }
                }
            }
        }
    }

    private fun done(appWidgetId: Int) {
        lifecycleScope.launch {
            val glanceId = GlanceAppWidgetManager(this@WidgetConfigActivity).getGlanceIdBy(appWidgetId)
            val provider = AppWidgetManager.getInstance(this@WidgetConfigActivity).getAppWidgetInfo(appWidgetId)?.provider?.className
            if (provider == StatBoxWidgetReceiver::class.java.name) {
                StatBoxWidget().update(this@WidgetConfigActivity, glanceId)
            } else {
                AddRowWidget().update(this@WidgetConfigActivity, glanceId)
            }
            setResult(RESULT_OK, Intent().putExtra(AppWidgetManager.EXTRA_APPWIDGET_ID, appWidgetId))
            finish()
        }
    }
}

@androidx.compose.runtime.Composable
private fun SaveButton(onClick: () -> Unit) {
    Button(
        onClick = onClick,
        modifier = Modifier.fillMaxWidth().height(48.dp),
        shape = RoundedCornerShape(8.dp),
        colors = ButtonDefaults.buttonColors(containerColor = HcColors.Action),
    ) {
        Text("Gem", fontSize = 17.sp, fontWeight = FontWeight.Bold)
    }
}
