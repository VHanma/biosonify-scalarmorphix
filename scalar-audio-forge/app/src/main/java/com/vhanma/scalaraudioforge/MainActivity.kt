package com.vhanma.scalaraudioforge

import android.app.Activity
import android.app.AlertDialog
import android.content.ClipData
import android.content.ClipboardManager
import android.content.Intent
import android.graphics.Color
import android.media.MediaPlayer
import android.net.Uri
import android.os.Bundle
import android.provider.DocumentsContract
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
    private val pickBatch = 1003
    private val pickBatchFolder = 1004

    private var sourceUri: Uri? = null
    private val batchUris = mutableListOf<Uri>()
    private var processedFile: File? = null
    private var processedFormat = OutputFormat.WAV16
    private var player: MediaPlayer? = null
    private val executor = Executors.newSingleThreadExecutor()
    private lateinit var store: PresetStore

    private val stack = mutableListOf<TransformSpec>()
    private val branches = mutableListOf<ForgeBranch>()

    private lateinit var fileText: TextView
    private lateinit var batchText: TextView
    private lateinit var descriptionText: TextView
    private lateinit var stackText: TextView
    private lateinit var branchText: TextView
    private lateinit var dnaText: TextView
    private lateinit var statusText: TextView
    private lateinit var progress: ProgressBar
    private lateinit var visualizer: WaveformView
    private lateinit var quickSpinner: Spinner
    private lateinit var transformSpinner: Spinner
    private lateinit var amountSeek: SeekBar
    private lateinit var savedSpinner: Spinner
    private lateinit var outputSpinner: Spinner
    private lateinit var mergeSpinner: Spinner
    private lateinit var branchWeightSeek: SeekBar
    private lateinit var convertOnly: CheckBox
    private lateinit var matrixCheck: CheckBox

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
            setPadding(dp(18), dp(34), dp(18), dp(42))
        }
        scroll.addView(root)

        root.addView(label("SCALAR AUDIO FORGE 1.1", 27f, Color.WHITE).apply { setTypeface(typeface, 1) })
        root.addView(label("Streaming converter + Matrix Lab + reproducible experimental DSP", 14f, Color.rgb(170, 175, 194)))
        root.addView(spacer(12))

        root.addView(button("IMPORT SINGLE AUDIO / VIDEO") { openSource() })
        fileText = label("No single source selected", 14f, Color.LTGRAY)
        root.addView(fileText)
        root.addView(button("IMPORT BATCH") { openBatch() })
        batchText = label("Batch empty", 13f, Color.rgb(170, 175, 194))
        root.addView(batchText)

        convertOnly = CheckBox(this).apply {
            text = "Convert Only: bypass every experimental transform"
            setTextColor(Color.WHITE)
            setOnCheckedChangeListener { _, checked ->
                updateStackLabel(if (checked) "DSP bypass active" else null)
            }
        }
        root.addView(convertOnly)

        root.addView(section("QUICK COMBOS"))
        quickSpinner = Spinner(this)
        quickSpinner.adapter = darkAdapter(PresetLibrary.quick.map { it.name })
        root.addView(quickSpinner, LinearLayout.LayoutParams(-1, dp(52)))
        root.addView(button("LOAD QUICK COMBO INTO STACK") { selectQuickPreset(quickSpinner.selectedItemPosition) })
        descriptionText = label("", 13f, Color.rgb(193, 197, 213))
        root.addView(descriptionText)

        root.addView(section("CUSTOM / MASTER STACK"))
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
        val stackRow = LinearLayout(this).apply { orientation = LinearLayout.HORIZONTAL }
        stackRow.addView(button("REMOVE LAST") {
            if (stack.isNotEmpty()) stack.removeAt(stack.lastIndex)
            updateStackLabel()
        }, LinearLayout.LayoutParams(0, dp(48), 1f))
        stackRow.addView(button("CLEAR") { stack.clear(); updateStackLabel() }, LinearLayout.LayoutParams(0, dp(48), 1f))
        root.addView(stackRow)
        stackText = label("Stack empty", 13f, Color.rgb(156, 124, 255))
        root.addView(stackText)
        root.addView(label("Matrix ON: this stack becomes the post-merge MASTER chain. Matrix OFF: it is the normal sequential chain.", 12f, Color.GRAY))
        root.addView(button("SAVE CUSTOM PRESET") { promptSavePreset() })
        savedSpinner = Spinner(this)
        root.addView(savedSpinner, LinearLayout.LayoutParams(-1, dp(52)))
        val savedRow = LinearLayout(this).apply { orientation = LinearLayout.HORIZONTAL }
        savedRow.addView(button("LOAD SAVED") { loadSaved() }, LinearLayout.LayoutParams(0, dp(48), 1f))
        savedRow.addView(button("DELETE") { deleteSaved() }, LinearLayout.LayoutParams(0, dp(48), 1f))
        root.addView(savedRow)

        root.addView(section("MATRIX LAB • PARALLEL ROUTING"))
        matrixCheck = CheckBox(this).apply {
            text = "Enable Matrix parallel branches"
            setTextColor(Color.WHITE)
        }
        root.addView(matrixCheck)
        mergeSpinner = Spinner(this)
        mergeSpinner.adapter = darkAdapter(MergeMode.entries.map { it.label })
        root.addView(mergeSpinner, LinearLayout.LayoutParams(-1, dp(52)))
        branchWeightSeek = SeekBar(this).apply { max = 200; progress = 100 }
        root.addView(label("New branch weight: 0.00 to 2.00", 12f, Color.GRAY))
        root.addView(branchWeightSeek)
        root.addView(button("ADD CURRENT STACK AS PARALLEL BRANCH") { addCurrentBranch() })
        val matrixRow = LinearLayout(this).apply { orientation = LinearLayout.HORIZONTAL }
        matrixRow.addView(button("REMOVE BRANCH") {
            if (branches.isNotEmpty()) branches.removeAt(branches.lastIndex)
            updateBranchLabel()
        }, LinearLayout.LayoutParams(0, dp(48), 1f))
        matrixRow.addView(button("CLEAR MATRIX") {
            branches.clear()
            matrixCheck.isChecked = false
            updateBranchLabel()
        }, LinearLayout.LayoutParams(0, dp(48), 1f))
        root.addView(matrixRow)
        branchText = label("No branches", 13f, Color.rgb(73, 210, 180))
        root.addView(branchText)
        root.addView(label("Each branch receives the same source chunk independently, then the selected merge math combines the results. After adding a branch the working stack clears so you can build another branch or a master chain.", 12f, Color.GRAY))

        root.addView(section("PRESET DNA"))
        val dnaRow = LinearLayout(this).apply { orientation = LinearLayout.HORIZONTAL }
        dnaRow.addView(button("COPY DNA") { copyDna() }, LinearLayout.LayoutParams(0, dp(48), 1f))
        dnaRow.addView(button("IMPORT DNA") { promptImportDna() }, LinearLayout.LayoutParams(0, dp(48), 1f))
        root.addView(dnaRow)
        dnaText = label("SAF2 codes preserve transform types, strengths, branch weights and merge mode.", 12f, Color.rgb(170, 175, 194))
        root.addView(dnaText)

        root.addView(section("WAVEFORM + SPECTROGRAM"))
        visualizer = WaveformView(this)
        root.addView(visualizer, LinearLayout.LayoutParams(-1, dp(390)))

        root.addView(section("EXPORT ENGINE"))
        outputSpinner = Spinner(this)
        outputSpinner.adapter = darkAdapter(OutputFormat.entries.map { it.label })
        root.addView(outputSpinner, LinearLayout.LayoutParams(-1, dp(52)))
        root.addView(label("WAV 16/24/float, RF64 for huge PCM, plus hardware/software codec-backed AAC and Opus where Android exposes an encoder.", 12f, Color.GRAY))
        root.addView(button("PROCESS SINGLE") { processSingle() })
        root.addView(button("BATCH: CHOOSE OUTPUT FOLDER + RUN") { chooseBatchFolder() })
        progress = ProgressBar(this, null, android.R.attr.progressBarStyleHorizontal).apply { max = 1000 }
        root.addView(progress, LinearLayout.LayoutParams(-1, dp(18)))
        statusText = label("Ready", 13f, Color.rgb(73, 210, 180))
        root.addView(statusText)

        val previewRow = LinearLayout(this).apply { orientation = LinearLayout.HORIZONTAL }
        previewRow.addView(button("PLAY ORIGINAL") { playOriginal() }, LinearLayout.LayoutParams(0, dp(50), 1f))
        previewRow.addView(button("PLAY RESULT") { playProcessed() }, LinearLayout.LayoutParams(0, dp(50), 1f))
        root.addView(previewRow)
        root.addView(button("SAVE LAST SINGLE RESULT TO PHONE") { exportResult() })

        root.addView(section("EXPERIMENT NOTES"))
        root.addView(label("Labels such as scalar, longitudinal, Tesla, Meyl, Bearden and Puharich identify experimental models or inspirations. Every preset is also implemented as explicit measurable audio DSP. The phone audio output alone does not establish exotic field propagation.", 12f, Color.rgb(156, 160, 177)))
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

    private fun addCurrentBranch() {
        if (stack.isEmpty()) return toast("Build or load a stack first")
        val weight = (branchWeightSeek.progress / 100f).coerceIn(0.01f, 2f)
        branches += ForgeBranch("Branch ${branches.size + 1}", weight, stack.toList())
        stack.clear()
        convertOnly.isChecked = false
        matrixCheck.isChecked = true
        updateStackLabel()
        updateBranchLabel()
    }

    private fun currentMatrix(): ForgeMatrix {
        if (convertOnly.isChecked) return ForgeMatrix()
        return ForgeMatrix(
            enabled = matrixCheck.isChecked && branches.isNotEmpty(),
            mode = MergeMode.entries[mergeSpinner.selectedItemPosition],
            branches = branches.toList(),
            master = stack.toList()
        )
    }

    private fun updateStackLabel(override: String? = null) {
        stackText.text = override ?: if (stack.isEmpty()) "Stack empty" else stack.mapIndexed { i, t ->
            "${i + 1}. ${t.kind.title}  ${(t.amount * 100).toInt()}%"
        }.joinToString("\n")
    }

    private fun updateBranchLabel() {
        branchText.text = if (branches.isEmpty()) "No branches" else branches.mapIndexed { index, branch ->
            val chain = branch.transforms.joinToString(" → ") { it.kind.title }
            "${index + 1}. ${branch.name}  weight ${"%.2f".format(java.util.Locale.US, branch.weight)}\n   $chain"
        }.joinToString("\n")
    }

    private fun copyDna() {
        val state = PresetDna.State(stack.toList(), currentMatrix())
        val code = PresetDna.encode(state)
        val clipboard = getSystemService(CLIPBOARD_SERVICE) as ClipboardManager
        clipboard.setPrimaryClip(ClipData.newPlainText("Scalar Audio Forge Preset DNA", code))
        dnaText.text = code
        toast("Preset DNA copied")
    }

    private fun promptImportDna() {
        val input = EditText(this).apply {
            hint = "Paste SAF2: code"
            minLines = 4
            setTextColor(Color.WHITE)
            setHintTextColor(Color.GRAY)
        }
        AlertDialog.Builder(this)
            .setTitle("Import Preset DNA")
            .setView(input)
            .setPositiveButton("IMPORT") { _, _ ->
                runCatching { PresetDna.decode(input.text.toString()) }
                    .onSuccess { state ->
                        stack.clear(); stack.addAll(state.stack)
                        branches.clear(); branches.addAll(state.matrix.branches)
                        matrixCheck.isChecked = state.matrix.enabled && branches.isNotEmpty()
                        mergeSpinner.setSelection(state.matrix.mode.ordinal)
                        convertOnly.isChecked = stack.isEmpty() && branches.isEmpty()
                        updateStackLabel(); updateBranchLabel()
                        dnaText.text = "Imported SAF2 preset DNA"
                        toast("Preset DNA loaded")
                    }
                    .onFailure { toast("DNA error: ${it.message}") }
            }
            .setNegativeButton("CANCEL", null)
            .show()
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

    private fun openBatch() {
        val intent = Intent(Intent.ACTION_OPEN_DOCUMENT).apply {
            addCategory(Intent.CATEGORY_OPENABLE)
            type = "*/*"
            putExtra(Intent.EXTRA_MIME_TYPES, arrayOf("audio/*", "video/*"))
            putExtra(Intent.EXTRA_ALLOW_MULTIPLE, true)
            flags = Intent.FLAG_GRANT_READ_URI_PERMISSION or Intent.FLAG_GRANT_PERSISTABLE_URI_PERMISSION
        }
        startActivityForResult(intent, pickBatch)
    }

    private fun chooseBatchFolder() {
        if (batchUris.isEmpty()) return toast("Import a batch first")
        val intent = Intent(Intent.ACTION_OPEN_DOCUMENT_TREE).apply {
            flags = Intent.FLAG_GRANT_READ_URI_PERMISSION or Intent.FLAG_GRANT_WRITE_URI_PERMISSION or Intent.FLAG_GRANT_PERSISTABLE_URI_PERMISSION
        }
        startActivityForResult(intent, pickBatchFolder)
    }

    private fun processSingle() {
        val uri = sourceUri ?: return toast("Choose a single audio or video first")
        stopPlayer()
        visualizer.clearHistory()
        progress.progress = 0
        val format = selectedOutputFormat()
        val target = File(cacheDir, "forge_${System.currentTimeMillis()}.${format.extension}")
        val matrix = currentMatrix()
        statusText.text = "Streaming decode + Matrix DSP…"
        executor.execute {
            runCatching {
                AudioPipeline.process(this, uri, target, matrix, format) { p, preview ->
                    runOnUiThread {
                        progress.progress = (p * 1000).toInt()
                        if (preview != null) visualizer.appendSamples(preview)
                        statusText.text = "Processing ${(p * 100).toInt()}%"
                    }
                }
            }.onSuccess { result ->
                processedFile = result.file
                processedFormat = result.format
                runOnUiThread {
                    progress.progress = 1000
                    statusText.text = "Done • ${result.sampleRate} Hz • ${result.channels} ch • ${result.format.label}"
                }
            }.onFailure { e ->
                runOnUiThread { statusText.text = "Error: ${e.message ?: e.javaClass.simpleName}" }
            }
        }
    }

    private fun runBatch(treeUri: Uri) {
        val sources = batchUris.toList()
        val matrix = currentMatrix()
        val format = selectedOutputFormat()
        visualizer.clearHistory()
        progress.progress = 0
        executor.execute {
            var completed = 0
            var failed = 0
            for ((index, uri) in sources.withIndex()) {
                val inputName = displayName(uri)
                val stem = inputName.substringBeforeLast('.', inputName).ifBlank { "forge_${index + 1}" }
                val target = File(cacheDir, "batch_${System.currentTimeMillis()}_${index}.${format.extension}")
                try {
                    val result = AudioPipeline.process(this, uri, target, matrix, format) { p, preview ->
                        val global = (index + p) / sources.size.toFloat()
                        runOnUiThread {
                            progress.progress = (global * 1000).toInt()
                            if (preview != null) visualizer.appendSamples(preview)
                            statusText.text = "Batch ${index + 1}/${sources.size} • ${(p * 100).toInt()}% • $inputName"
                        }
                    }
                    val outUri = createDocumentInTree(treeUri, format.mimeType, "$stem-forge.${format.extension}")
                    contentResolver.openOutputStream(outUri, "w")!!.use { output ->
                        result.file.inputStream().use { input -> input.copyTo(output, 1024 * 1024) }
                    }
                    result.file.delete()
                    completed++
                } catch (_: Throwable) {
                    failed++
                    target.delete()
                }
            }
            runOnUiThread {
                progress.progress = 1000
                statusText.text = "Batch finished • $completed saved • $failed failed"
                toast("Batch complete")
            }
        }
    }

    private fun createDocumentInTree(treeUri: Uri, mime: String, name: String): Uri {
        val documentId = DocumentsContract.getTreeDocumentId(treeUri)
        val parent = DocumentsContract.buildDocumentUriUsingTree(treeUri, documentId)
        return DocumentsContract.createDocument(contentResolver, parent, mime, name)
            ?: error("Selected folder did not create $name")
    }

    private fun playOriginal() {
        val uri = sourceUri ?: return toast("Choose a single source first")
        stopPlayer()
        player = MediaPlayer().apply {
            setDataSource(this@MainActivity, uri)
            setOnPreparedListener { it.start() }
            setOnCompletionListener { stopPlayer() }
            prepareAsync()
        }
    }

    private fun playProcessed() {
        val file = processedFile ?: return toast("Process a single file first")
        stopPlayer()
        player = MediaPlayer().apply {
            setDataSource(file.absolutePath)
            setOnPreparedListener { it.start() }
            setOnCompletionListener { stopPlayer() }
            prepareAsync()
        }
    }

    private fun exportResult() {
        val file = processedFile ?: return toast("Process a single file first")
        val format = processedFormat
        val intent = Intent(Intent.ACTION_CREATE_DOCUMENT).apply {
            addCategory(Intent.CATEGORY_OPENABLE)
            type = format.mimeType
            putExtra(Intent.EXTRA_TITLE, "ScalarAudioForge-result.${format.extension}")
        }
        if (file.exists()) startActivityForResult(intent, saveAudio)
    }

    override fun onActivityResult(requestCode: Int, resultCode: Int, data: Intent?) {
        super.onActivityResult(requestCode, resultCode, data)
        if (resultCode != RESULT_OK) return
        when (requestCode) {
            pickAudio -> data?.data?.let { uri ->
                persistRead(uri)
                sourceUri = uri
                fileText.text = displayName(uri)
                statusText.text = "Single source ready"
            }
            pickBatch -> {
                val collected = mutableListOf<Uri>()
                data?.clipData?.let { clip ->
                    for (i in 0 until clip.itemCount) collected += clip.getItemAt(i).uri
                }
                if (collected.isEmpty()) data?.data?.let { collected += it }
                collected.forEach { persistRead(it) }
                batchUris.clear(); batchUris.addAll(collected.distinct())
                batchText.text = if (batchUris.isEmpty()) "Batch empty" else "${batchUris.size} files ready"
                statusText.text = "Batch ready"
            }
            pickBatchFolder -> data?.data?.let { tree ->
                val flags = Intent.FLAG_GRANT_READ_URI_PERMISSION or Intent.FLAG_GRANT_WRITE_URI_PERMISSION
                runCatching { contentResolver.takePersistableUriPermission(tree, flags) }
                runBatch(tree)
            }
            saveAudio -> data?.data?.let { uri ->
                val src = processedFile ?: return@let
                executor.execute {
                    runCatching {
                        contentResolver.openOutputStream(uri, "w")!!.use { out ->
                            src.inputStream().use { it.copyTo(out, 1024 * 1024) }
                        }
                    }.onSuccess { runOnUiThread { toast("Saved to phone"); statusText.text = "Export saved" } }
                        .onFailure { e -> runOnUiThread { statusText.text = "Save error: ${e.message}" } }
                }
            }
        }
    }

    private fun persistRead(uri: Uri) {
        runCatching { contentResolver.takePersistableUriPermission(uri, Intent.FLAG_GRANT_READ_URI_PERMISSION) }
    }

    private fun promptSavePreset() {
        if (stack.isEmpty()) return toast("Add at least one transform to the working stack")
        val input = EditText(this).apply {
            hint = "Preset name"
            setTextColor(Color.WHITE)
            setHintTextColor(Color.GRAY)
        }
        AlertDialog.Builder(this)
            .setTitle("Save custom preset")
            .setView(input)
            .setPositiveButton("SAVE") { _, _ ->
                val name = input.text.toString().trim()
                if (name.isNotEmpty()) {
                    store.save(name, stack)
                    refreshSaved()
                    toast("Preset saved")
                }
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

    private fun selectedOutputFormat(): OutputFormat =
        OutputFormat.entries[outputSpinner.selectedItemPosition.coerceIn(0, OutputFormat.entries.lastIndex)]

    private fun displayName(uri: Uri): String {
        contentResolver.query(uri, arrayOf(OpenableColumns.DISPLAY_NAME), null, null, null)?.use { cursor ->
            if (cursor.moveToFirst()) return cursor.getString(0) ?: "Selected media"
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
