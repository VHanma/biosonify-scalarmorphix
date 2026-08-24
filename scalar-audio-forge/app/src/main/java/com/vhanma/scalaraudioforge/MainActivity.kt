package com.vhanma.scalaraudioforge

import android.app.Activity
import android.app.AlertDialog
import android.content.Intent
import android.graphics.Color
import android.media.MediaPlayer
import android.net.Uri
import android.os.Bundle
import android.provider.OpenableColumns
import android.view.Gravity
import android.view.View
import android.widget.ArrayAdapter
import android.widget.Button
import android.widget.CheckBox
import android.widget.EditText
import android.widget.LinearLayout
import android.widget.ProgressBar
import android.widget.ScrollView
import android.widget.SeekBar
import android.widget.Spinner
import android.widget.TextView
import android.widget.Toast
import java.io.File
import java.util.concurrent.Executors

class MainActivity : Activity() {
    private val pickAudio = 1001
    private val saveAudio = 1002
    private var sourceUri: Uri? = null
    private var processedFile: File? = null
    private var player: MediaPlayer? = null
    private val executor = Executors.newSingleThreadExecutor()
    private lateinit var store: PresetStore
    private val stack = mutableListOf<TransformSpec>()

    private lateinit var fileText: TextView
    private lateinit var descriptionText: TextView
    private lateinit var stackText: TextView
    private lateinit var statusText: TextView
    private lateinit var progress: ProgressBar
    private lateinit var visualizer: WaveformView
    private lateinit var quickSpinner: Spinner
    private lateinit var transformSpinner: Spinner
    private lateinit var amountSeek: SeekBar
    private lateinit var savedSpinner: Spinner
    private lateinit var outputSpinner: Spinner
    private lateinit var convertOnly: CheckBox

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        store = PresetStore(this)
        setContentView(buildUi())
        selectQuickPreset(0)
        refreshSaved()
    }

    private fun buildUi(): View {
        val scroll = ScrollView(this).apply { setBackgroundColor(Color.rgb(9, 11, 16)) }
        val root = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            setPadding(dp(18), dp(34), dp(18), dp(36))
        }
        scroll.addView(root)

        root.addView(label("SCALAR AUDIO FORGE", 27f, Color.WHITE).apply { setTypeface(typeface, 1) })
        root.addView(label("Converter + stackable experimental DSP workstation", 14f, Color.rgb(170, 175, 194)))
        root.addView(spacer(12))

        root.addView(button("IMPORT AUDIO / VIDEO") { openSource() })
        fileText = label("No source selected", 14f, Color.LTGRAY)
        root.addView(fileText)

        convertOnly = CheckBox(this).apply {
            text = "Convert Only: bypass all experimental transforms"
            setTextColor(Color.WHITE)
            setOnCheckedChangeListener { _, checked -> updateStackLabel(if (checked) "DSP bypass active" else null) }
        }
        root.addView(convertOnly)

        root.addView(section("QUICK COMBOS"))
        quickSpinner = Spinner(this)
        quickSpinner.adapter = darkAdapter(PresetLibrary.quick.map { it.name })
        root.addView(quickSpinner, LinearLayout.LayoutParams(-1, dp(52)))
        root.addView(button("APPLY QUICK COMBO") { selectQuickPreset(quickSpinner.selectedItemPosition) })
        descriptionText = label("", 13f, Color.rgb(193, 197, 213))
        root.addView(descriptionText)

        root.addView(section("CUSTOM STACK"))
        transformSpinner = Spinner(this)
        transformSpinner.adapter = darkAdapter(TransformKind.entries.map { it.title })
        root.addView(transformSpinner, LinearLayout.LayoutParams(-1, dp(52)))
        amountSeek = SeekBar(this).apply { max = 100; progress = 35 }
        root.addView(label("Transform strength", 12f, Color.GRAY))
        root.addView(amountSeek)
        root.addView(button("+ ADD TRANSFORM") {
            val kind = TransformKind.entries[transformSpinner.selectedItemPosition]
            stack += TransformSpec(kind, amountSeek.progress / 100f)
            convertOnly.isChecked = false
            updateStackLabel()
        })
        val row = LinearLayout(this).apply { orientation = LinearLayout.HORIZONTAL }
        row.addView(button("REMOVE LAST") { if (stack.isNotEmpty()) stack.removeAt(stack.lastIndex); updateStackLabel() }, LinearLayout.LayoutParams(0, dp(48), 1f))
        row.addView(button("CLEAR") { stack.clear(); updateStackLabel() }, LinearLayout.LayoutParams(0, dp(48), 1f))
        root.addView(row)
        stackText = label("Stack empty", 13f, Color.rgb(156, 124, 255))
        root.addView(stackText)
        root.addView(button("SAVE CUSTOM PRESET") { promptSavePreset() })

        savedSpinner = Spinner(this)
        root.addView(savedSpinner, LinearLayout.LayoutParams(-1, dp(52)))
        val savedRow = LinearLayout(this).apply { orientation = LinearLayout.HORIZONTAL }
        savedRow.addView(button("LOAD SAVED") { loadSaved() }, LinearLayout.LayoutParams(0, dp(48), 1f))
        savedRow.addView(button("DELETE") { deleteSaved() }, LinearLayout.LayoutParams(0, dp(48), 1f))
        root.addView(savedRow)

        root.addView(section("WAVES + SPECTRUM"))
        visualizer = WaveformView(this)
        root.addView(visualizer, LinearLayout.LayoutParams(-1, dp(310)))

        root.addView(section("EXPORT"))
        outputSpinner = Spinner(this)
        outputSpinner.adapter = darkAdapter(listOf("WAV (RIFF, up to 4 GB)", "RF64 (huge-file WAV)"))
        root.addView(outputSpinner, LinearLayout.LayoutParams(-1, dp(52)))
        root.addView(label("Input decoding streams through Android MediaCodec. RF64 removes the normal WAV 4 GB container ceiling.", 12f, Color.GRAY))
        root.addView(button("PROCESS / CONVERT") { process() })
        progress = ProgressBar(this, null, android.R.attr.progressBarStyleHorizontal).apply { max = 100 }
        root.addView(progress, LinearLayout.LayoutParams(-1, dp(18)))
        statusText = label("Ready", 13f, Color.rgb(73, 210, 180))
        root.addView(statusText)

        val previewRow = LinearLayout(this).apply { orientation = LinearLayout.HORIZONTAL }
        previewRow.addView(button("PLAY ORIGINAL") { playOriginal() }, LinearLayout.LayoutParams(0, dp(50), 1f))
        previewRow.addView(button("PLAY RESULT") { playProcessed() }, LinearLayout.LayoutParams(0, dp(50), 1f))
        root.addView(previewRow)
        root.addView(button("SAVE RESULT TO PHONE") { exportResult() })

        root.addView(section("EXPERIMENT NOTES"))
        root.addView(label("Names such as scalar, longitudinal, Tesla, Meyl, Bearden and Puharich identify the experimental model being explored. The app also states the exact measurable DSP operation. Phone audio processing by itself does not establish exotic propagation.", 12f, Color.rgb(156, 160, 177)))
        return scroll
    }

    private fun selectQuickPreset(index: Int) {
        val preset = PresetLibrary.quick[index.coerceIn(0, PresetLibrary.quick.lastIndex)]
        stack.clear()
        stack.addAll(preset.transforms)
        convertOnly.isChecked = preset.transforms.isEmpty()
        descriptionText.text = preset.description + "\n\n" + preset.transforms.joinToString("\n") { "• ${it.kind.title}: ${it.kind.dsp}" }
        updateStackLabel()
    }

    private fun updateStackLabel(override: String? = null) {
        stackText.text = override ?: if (stack.isEmpty()) "Stack empty" else stack.mapIndexed { i, t -> "${i + 1}. ${t.kind.title}  ${(t.amount * 100).toInt()}%" }.joinToString("\n")
    }

    private fun openSource() {
        val intent = Intent(Intent.ACTION_OPEN_DOCUMENT).apply {
            addCategory(Intent.CATEGORY_OPENABLE)
            type = "*/*"
            putExtra(Intent.EXTRA_MIME_TYPES, arrayOf("audio/*", "video/*"))
            flags = Intent.FLAG_GRANT_READ_URI_PERMISSION or Intent.FLAG_GRANT_PERSISTABLE_URI_PERMISSION
        }
        startActivityForResult(intent, pickAudio)
    }

    private fun process() {
        val uri = sourceUri ?: return toast("Choose audio or video first")
        stopPlayer()
        progress.progress = 0
        statusText.text = "Streaming decode + DSP…"
        val rf64 = outputSpinner.selectedItemPosition == 1
        val active = if (convertOnly.isChecked) emptyList() else stack.toList()
        val target = File(cacheDir, "forge_${System.currentTimeMillis()}.${if (rf64) "rf64.wav" else "wav"}")
        executor.execute {
            runCatching {
                AudioPipeline.process(this, uri, target, active, rf64) { p, preview ->
                    runOnUiThread {
                        progress.progress = (p * 100).toInt()
                        if (preview != null) visualizer.setSamples(preview)
                        statusText.text = "Processing ${(p * 100).toInt()}%"
                    }
                }
            }.onSuccess { result ->
                processedFile = result.file
                runOnUiThread {
                    progress.progress = 100
                    statusText.text = "Done • ${result.sampleRate} Hz • ${result.channels} ch • ${if (result.rf64) "RF64" else "WAV"}"
                }
            }.onFailure { e ->
                runOnUiThread { statusText.text = "Error: ${e.message ?: e.javaClass.simpleName}" }
            }
        }
    }

    private fun playOriginal() {
        val uri = sourceUri ?: return toast("Choose a source first")
        stopPlayer()
        player = MediaPlayer().apply {
            setDataSource(this@MainActivity, uri)
            setOnPreparedListener { it.start() }
            setOnCompletionListener { stopPlayer() }
            prepareAsync()
        }
    }

    private fun playProcessed() {
        val file = processedFile ?: return toast("Process the audio first")
        stopPlayer()
        player = MediaPlayer().apply {
            setDataSource(file.absolutePath)
            setOnPreparedListener { it.start() }
            setOnCompletionListener { stopPlayer() }
            prepareAsync()
        }
    }

    private fun exportResult() {
        if (processedFile == null) return toast("Process the audio first")
        val intent = Intent(Intent.ACTION_CREATE_DOCUMENT).apply {
            addCategory(Intent.CATEGORY_OPENABLE)
            type = "audio/wav"
            putExtra(Intent.EXTRA_TITLE, if (outputSpinner.selectedItemPosition == 1) "ScalarAudioForge-result-rf64.wav" else "ScalarAudioForge-result.wav")
        }
        startActivityForResult(intent, saveAudio)
    }

    override fun onActivityResult(requestCode: Int, resultCode: Int, data: Intent?) {
        super.onActivityResult(requestCode, resultCode, data)
        if (resultCode != RESULT_OK) return
        when (requestCode) {
            pickAudio -> data?.data?.let { uri ->
                sourceUri = uri
                runCatching { contentResolver.takePersistableUriPermission(uri, Intent.FLAG_GRANT_READ_URI_PERMISSION) }
                fileText.text = displayName(uri)
                statusText.text = "Source ready"
            }
            saveAudio -> data?.data?.let { uri ->
                val src = processedFile ?: return@let
                executor.execute {
                    runCatching {
                        contentResolver.openOutputStream(uri, "w")!!.use { out -> src.inputStream().use { it.copyTo(out, 1024 * 1024) } }
                    }.onSuccess { runOnUiThread { toast("Saved to phone"); statusText.text = "Export saved" } }
                        .onFailure { e -> runOnUiThread { statusText.text = "Save error: ${e.message}" } }
                }
            }
        }
    }

    private fun promptSavePreset() {
        if (stack.isEmpty()) return toast("Add at least one transform")
        val input = EditText(this).apply { hint = "Preset name"; setTextColor(Color.WHITE); setHintTextColor(Color.GRAY) }
        AlertDialog.Builder(this)
            .setTitle("Save custom preset")
            .setView(input)
            .setPositiveButton("SAVE") { _, _ ->
                val name = input.text.toString().trim()
                if (name.isNotEmpty()) { store.save(name, stack); refreshSaved(); toast("Preset saved") }
            }
            .setNegativeButton("CANCEL", null)
            .show()
    }

    private fun refreshSaved() {
        val names = store.names()
        savedSpinner.adapter = darkAdapter(if (names.isEmpty()) listOf("No saved presets") else names)
    }

    private fun loadSaved() {
        val name = savedSpinner.selectedItem?.toString() ?: return
        if (name == "No saved presets") return
        stack.clear()
        stack.addAll(store.load(name))
        convertOnly.isChecked = false
        updateStackLabel()
        descriptionText.text = "Custom preset: $name\n" + stack.joinToString("\n") { "• ${it.kind.title}: ${it.kind.dsp}" }
    }

    private fun deleteSaved() {
        val name = savedSpinner.selectedItem?.toString() ?: return
        if (name == "No saved presets") return
        store.delete(name)
        refreshSaved()
        toast("Preset deleted")
    }

    private fun displayName(uri: Uri): String {
        contentResolver.query(uri, arrayOf(OpenableColumns.DISPLAY_NAME), null, null, null)?.use { c ->
            if (c.moveToFirst()) return c.getString(0)
        }
        return uri.lastPathSegment ?: "Selected media"
    }

    private fun stopPlayer() {
        runCatching { player?.stop() }
        player?.release()
        player = null
    }

    override fun onDestroy() {
        stopPlayer()
        executor.shutdownNow()
        super.onDestroy()
    }

    private fun darkAdapter(items: List<String>) = ArrayAdapter(this, android.R.layout.simple_spinner_dropdown_item, items)

    private fun button(text: String, action: () -> Unit) = Button(this).apply {
        this.text = text
        isAllCaps = false
        setTextColor(Color.WHITE)
        setBackgroundColor(Color.rgb(45, 36, 73))
        setOnClickListener { action() }
        gravity = Gravity.CENTER
    }

    private fun label(text: String, size: Float, color: Int) = TextView(this).apply {
        this.text = text
        textSize = size
        setTextColor(color)
        setPadding(0, dp(4), 0, dp(6))
    }

    private fun section(text: String) = label(text, 16f, Color.rgb(156, 124, 255)).apply {
        setPadding(0, dp(22), 0, dp(8))
        setTypeface(typeface, 1)
    }

    private fun spacer(h: Int) = View(this).apply { layoutParams = LinearLayout.LayoutParams(1, dp(h)) }
    private fun dp(v: Int) = (v * resources.displayMetrics.density).toInt()
    private fun toast(message: String) = Toast.makeText(this, message, Toast.LENGTH_SHORT).show()
}
