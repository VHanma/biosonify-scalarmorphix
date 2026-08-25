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
import android.view.WindowManager
import android.widget.AdapterView
import android.widget.ArrayAdapter
import android.widget.Button
import android.widget.CheckBox
import android.widget.EditText
import android.widget.LinearLayout
import android.widget.ProgressBar
import android.widget.ScrollView
import android.widget.Spinner
import android.widget.TextView
import android.widget.Toast
import java.util.Locale
import java.util.concurrent.Executors
import java.util.concurrent.atomic.AtomicBoolean

class MainActivity : Activity() {
    private val pickAudio = 1001
    private val pickBatch = 1002
    private val pickBatchFolder = 1003
    private val pickSingleDestination = 1004

    private var sourceUri: Uri? = null
    private val batchUris = mutableListOf<Uri>()
    private var processedUri: Uri? = null
    private var processedFormat = OutputFormat.WAV16
    private var player: MediaPlayer? = null
    private val executor = Executors.newSingleThreadExecutor()
    private val processing = AtomicBoolean(false)
    private lateinit var store: PresetStore

    private val stack = mutableListOf<TransformSpec>()
    private val branches = mutableListOf<ForgeBranch>()
    private val visiblePresets = mutableListOf<ForgePreset>()
    private val visibleKinds = mutableListOf<TransformKind>()

    private var pendingMatrix: ForgeMatrix? = null
    private var pendingFormat: OutputFormat? = null

    private lateinit var fileText: TextView
    private lateinit var batchText: TextView
    private lateinit var descriptionText: TextView
    private lateinit var stackText: TextView
    private lateinit var branchText: TextView
    private lateinit var dnaText: TextView
    private lateinit var waveLegendText: TextView
    private lateinit var statusText: TextView
    private lateinit var progress: ProgressBar
    private lateinit var visualizer: WaveformView
    private lateinit var presetCategorySpinner: Spinner
    private lateinit var quickSpinner: Spinner
    private lateinit var waveCategorySpinner: Spinner
    private lateinit var transformSpinner: Spinner
    private lateinit var savedSpinner: Spinner
    private lateinit var outputSpinner: Spinner
    private lateinit var mergeSpinner: Spinner
    private lateinit var convertOnly: CheckBox
    private lateinit var matrixCheck: CheckBox

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        store = PresetStore(this)
        setContentView(buildUi())
        refreshPresetList()
        refreshWaveList()
        refreshSaved()
        visiblePresets.firstOrNull()?.let { applyPresetFullChain(it) }
    }

    private fun buildUi(): View {
        val scroll = ScrollView(this).apply { setBackgroundColor(Color.rgb(9, 11, 16)) }
        val root = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            setPadding(dp(18), dp(34), dp(18), dp(42))
        }
        scroll.addView(root)

        root.addView(label("SCALAR AUDIO FORGE 1.2", 27f, Color.WHITE).apply { setTypeface(typeface, 1) })
        root.addView(label("Huge-file-safe converter + full-method Scalar Forge + Matrix Lab", 14f, Color.rgb(170, 175, 194)))
        root.addView(label("HUGE-FILE SAFE MODE: ON • output streams directly to your chosen destination", 12f, Color.rgb(73, 210, 180)))
        root.addView(spacer(12))

        root.addView(button("IMPORT SINGLE AUDIO / VIDEO") { openSource() })
        fileText = label("No single source selected", 14f, Color.LTGRAY)
        root.addView(fileText)
        root.addView(button("IMPORT BATCH") { openBatch() })
        batchText = label("Batch empty", 13f, Color.rgb(170, 175, 194))
        root.addView(batchText)

        convertOnly = CheckBox(this).apply {
            text = "Convert Only • bypass experimental DSP"
            setTextColor(Color.WHITE)
            setOnCheckedChangeListener { _, _ -> updateAllLabels() }
        }
        root.addView(convertOnly)

        root.addView(section("QUICK COMBOS • ORGANIZED"))
        presetCategorySpinner = Spinner(this)
        presetCategorySpinner.adapter = darkAdapter(PresetCategory.entries.map { it.label })
        root.addView(presetCategorySpinner, LinearLayout.LayoutParams(-1, dp(50)))
        quickSpinner = Spinner(this)
        root.addView(quickSpinner, LinearLayout.LayoutParams(-1, dp(50)))
        descriptionText = label("Choose a combo", 13f, Color.rgb(193, 197, 213))
        root.addView(descriptionText)
        root.addView(button("APPLY AS FULL CHAIN") { selectedPreset()?.let { applyPresetFullChain(it) } })
        root.addView(button("APPLY AS FULL MERGE") { selectedPreset()?.let { applyPresetParallel(it, MergeMode.FULL_MERGE) } })
        root.addView(button("APPLY SIDE-BY-SIDE") { selectedPreset()?.let { applyPresetParallel(it, MergeMode.STEREO_SIDE_BY_SIDE) } })
        root.addView(label("FULL CHAIN = every method fully applied in order. FULL MERGE = every method gets a full copy, then all method changes are combined. SIDE-BY-SIDE = independent full copies on stereo sides.", 12f, Color.GRAY))

        presetCategorySpinner.onItemSelectedListener = object : AdapterView.OnItemSelectedListener {
            override fun onItemSelected(parent: AdapterView<*>?, view: View?, position: Int, id: Long) = refreshPresetList()
            override fun onNothingSelected(parent: AdapterView<*>?) = Unit
        }
        quickSpinner.onItemSelectedListener = object : AdapterView.OnItemSelectedListener {
            override fun onItemSelected(parent: AdapterView<*>?, view: View?, position: Int, id: Long) = showSelectedPresetDescription()
            override fun onNothingSelected(parent: AdapterView<*>?) = Unit
        }

        root.addView(section("WAVE / METHOD BROWSER"))
        waveCategorySpinner = Spinner(this)
        waveCategorySpinner.adapter = darkAdapter(WaveCategory.entries.map { it.label })
        root.addView(waveCategorySpinner, LinearLayout.LayoutParams(-1, dp(50)))
        transformSpinner = Spinner(this)
        root.addView(transformSpinner, LinearLayout.LayoutParams(-1, dp(50)))
        val methodRow = LinearLayout(this).apply { orientation = LinearLayout.HORIZONTAL }
        methodRow.addView(button("INFO TABS") { selectedKind()?.let { showWaveInfo(it) } }, LinearLayout.LayoutParams(0, dp(50), 1f))
        methodRow.addView(button("+ ADD FULL METHOD") { addSelectedMethod() }, LinearLayout.LayoutParams(0, dp(50), 1f))
        root.addView(methodRow)
        root.addView(label("Every selected method is ON at its complete defined profile. There is no scalar/Schumann/Tesla percentage control.", 12f, Color.rgb(73, 210, 180)))

        waveCategorySpinner.onItemSelectedListener = object : AdapterView.OnItemSelectedListener {
            override fun onItemSelected(parent: AdapterView<*>?, view: View?, position: Int, id: Long) = refreshWaveList()
            override fun onNothingSelected(parent: AdapterView<*>?) = Unit
        }

        root.addView(section("WORKING FULL-METHOD CHAIN"))
        stackText = label("Chain empty", 13f, Color.rgb(156, 124, 255))
        root.addView(stackText)
        val stackRow = LinearLayout(this).apply { orientation = LinearLayout.HORIZONTAL }
        stackRow.addView(button("REMOVE LAST") {
            if (stack.isNotEmpty()) stack.removeAt(stack.lastIndex)
            updateAllLabels()
        }, LinearLayout.LayoutParams(0, dp(48), 1f))
        stackRow.addView(button("CLEAR") {
            stack.clear()
            updateAllLabels()
        }, LinearLayout.LayoutParams(0, dp(48), 1f))
        root.addView(stackRow)
        root.addView(button("SAVE COMPLETE CUSTOM PRESET") { promptSavePreset() })
        savedSpinner = Spinner(this)
        root.addView(savedSpinner, LinearLayout.LayoutParams(-1, dp(50)))
        val savedRow = LinearLayout(this).apply { orientation = LinearLayout.HORIZONTAL }
        savedRow.addView(button("LOAD SAVED") { loadSaved() }, LinearLayout.LayoutParams(0, dp(48), 1f))
        savedRow.addView(button("DELETE") { deleteSaved() }, LinearLayout.LayoutParams(0, dp(48), 1f))
        root.addView(savedRow)

        root.addView(section("MATRIX LAB • FULL COPIES"))
        matrixCheck = CheckBox(this).apply {
            text = "Enable parallel-copy Matrix"
            setTextColor(Color.WHITE)
            setOnCheckedChangeListener { _, _ -> updateAllLabels() }
        }
        root.addView(matrixCheck)
        mergeSpinner = Spinner(this)
        mergeSpinner.adapter = darkAdapter(MergeMode.entries.map { it.label })
        root.addView(mergeSpinner, LinearLayout.LayoutParams(-1, dp(52)))
        root.addView(button("ADD CURRENT FULL CHAIN AS ONE BRANCH") { addCurrentBranch() })
        root.addView(button("SPLIT EACH CURRENT METHOD INTO ITS OWN FULL COPY") { splitStackIntoBranches() })
        val matrixRow = LinearLayout(this).apply { orientation = LinearLayout.HORIZONTAL }
        matrixRow.addView(button("REMOVE BRANCH") {
            if (branches.isNotEmpty()) branches.removeAt(branches.lastIndex)
            updateAllLabels()
        }, LinearLayout.LayoutParams(0, dp(48), 1f))
        matrixRow.addView(button("CLEAR MATRIX") {
            branches.clear()
            matrixCheck.isChecked = false
            updateAllLabels()
        }, LinearLayout.LayoutParams(0, dp(48), 1f))
        root.addView(matrixRow)
        branchText = label("No parallel copies", 13f, Color.rgb(73, 210, 180))
        root.addView(branchText)
        root.addView(label("FULL MERGE keeps the dry signal once and adds each branch's complete transformation change. SIDE-BY-SIDE routes independent full copies to L/R. Peak protection only prevents clipping; it is not a method-strength control.", 12f, Color.GRAY))

        root.addView(section("PRESET DNA"))
        val dnaRow = LinearLayout(this).apply { orientation = LinearLayout.HORIZONTAL }
        dnaRow.addView(button("COPY DNA") { copyDna() }, LinearLayout.LayoutParams(0, dp(48), 1f))
        dnaRow.addView(button("IMPORT DNA") { promptImportDna() }, LinearLayout.LayoutParams(0, dp(48), 1f))
        root.addView(dnaRow)
        dnaText = label("SAF3 stores the exact full-method routing. Legacy SAF2 codes still import; old strength values are ignored.", 12f, Color.rgb(170, 175, 194))
        root.addView(dnaText)

        root.addView(section("LABELED WAVEFORM + SPECTROGRAM"))
        waveLegendText = label("Active methods: Convert Only", 12f, Color.rgb(193, 197, 213))
        root.addView(waveLegendText)
        visualizer = WaveformView(this)
        root.addView(visualizer, LinearLayout.LayoutParams(-1, dp(410)))

        root.addView(section("EXPORT ENGINE"))
        outputSpinner = Spinner(this)
        outputSpinner.adapter = darkAdapter(OutputFormat.entries.map { it.label })
        root.addView(outputSpinner, LinearLayout.LayoutParams(-1, dp(52)))
        root.addView(label("Direct destination streaming prevents giant outputs from filling the app's private cache. RF64 removes the normal 4 GB RIFF ceiling. AAC/Opus depend on an encoder exposed by your Android device.", 12f, Color.GRAY))
        root.addView(button("PROCESS + SAVE DIRECTLY") { chooseSingleDestination() })
        root.addView(button("BATCH: CHOOSE OUTPUT FOLDER + RUN") { chooseBatchFolder() })
        progress = ProgressBar(this, null, android.R.attr.progressBarStyleHorizontal).apply { max = 1000 }
        root.addView(progress, LinearLayout.LayoutParams(-1, dp(18)))
        statusText = label("Ready", 13f, Color.rgb(73, 210, 180))
        root.addView(statusText)

        val previewRow = LinearLayout(this).apply { orientation = LinearLayout.HORIZONTAL }
        previewRow.addView(button("PLAY ORIGINAL") { playOriginal() }, LinearLayout.LayoutParams(0, dp(50), 1f))
        previewRow.addView(button("PLAY SAVED RESULT") { playProcessed() }, LinearLayout.LayoutParams(0, dp(50), 1f))
        root.addView(previewRow)

        root.addView(section("EXPERIMENT STATUS"))
        root.addView(label("The app keeps the historical/experimental labels visible while also explaining the exact digital operation. A scalar, longitudinal, Tesla, Meyl, Bearden, DNA or Puharich label does not by itself prove exotic propagation or biological effects.", 12f, Color.rgb(156, 160, 177)))
        return scroll
    }

    private fun refreshPresetList() {
        if (!::presetCategorySpinner.isInitialized || !::quickSpinner.isInitialized) return
        val category = PresetCategory.entries[presetCategorySpinner.selectedItemPosition.coerceIn(0, PresetCategory.entries.lastIndex)]
        visiblePresets.clear()
        visiblePresets.addAll(PresetLibrary.byCategory(category))
        quickSpinner.adapter = darkAdapter(if (visiblePresets.isEmpty()) listOf("No presets") else visiblePresets.map { it.name })
        showSelectedPresetDescription()
    }

    private fun refreshWaveList() {
        if (!::waveCategorySpinner.isInitialized || !::transformSpinner.isInitialized) return
        val category = WaveCategory.entries[waveCategorySpinner.selectedItemPosition.coerceIn(0, WaveCategory.entries.lastIndex)]
        visibleKinds.clear()
        visibleKinds.addAll(TransformKind.entries.filter { it.category == category })
        transformSpinner.adapter = darkAdapter(if (visibleKinds.isEmpty()) listOf("No methods") else visibleKinds.map { it.title })
    }

    private fun selectedPreset(): ForgePreset? = visiblePresets.getOrNull(quickSpinner.selectedItemPosition)
    private fun selectedKind(): TransformKind? = visibleKinds.getOrNull(transformSpinner.selectedItemPosition)

    private fun showSelectedPresetDescription() {
        if (!::descriptionText.isInitialized) return
        val preset = selectedPreset()
        descriptionText.text = if (preset == null) "No preset in this category" else buildString {
            append(preset.category.label).append(" • ").append(preset.name).append('\n')
            append(preset.description)
            if (preset.transforms.isNotEmpty()) {
                append("\n\nFULL METHODS:\n")
                preset.transforms.forEach { append("• ").append(it.kind.title).append('\n') }
            }
        }.trim()
    }

    private fun applyPresetFullChain(preset: ForgePreset) {
        stack.clear()
        branches.clear()
        stack.addAll(preset.transforms)
        matrixCheck.isChecked = false
        convertOnly.isChecked = preset.transforms.isEmpty()
        updateAllLabels()
    }

    private fun applyPresetParallel(preset: ForgePreset, mode: MergeMode) {
        stack.clear()
        branches.clear()
        if (preset.transforms.isEmpty()) {
            convertOnly.isChecked = true
            matrixCheck.isChecked = false
        } else {
            preset.transforms.forEachIndexed { index, transform ->
                branches += ForgeBranch("${transform.kind.title} copy ${index + 1}", listOf(transform))
            }
            mergeSpinner.setSelection(mode.ordinal)
            matrixCheck.isChecked = true
            convertOnly.isChecked = false
        }
        updateAllLabels()
    }

    private fun addSelectedMethod() {
        val kind = selectedKind() ?: return
        stack += TransformSpec(kind)
        convertOnly.isChecked = false
        updateAllLabels()
    }

    private fun addCurrentBranch() {
        if (stack.isEmpty()) return toast("Add at least one full method first")
        branches += ForgeBranch("Full chain copy ${branches.size + 1}", stack.toList())
        stack.clear()
        matrixCheck.isChecked = true
        convertOnly.isChecked = false
        updateAllLabels()
    }

    private fun splitStackIntoBranches() {
        if (stack.isEmpty()) return toast("Add methods to the working chain first")
        stack.forEach { method -> branches += ForgeBranch(method.kind.title, listOf(method)) }
        stack.clear()
        matrixCheck.isChecked = true
        convertOnly.isChecked = false
        updateAllLabels()
    }

    private fun currentMatrix(): ForgeMatrix {
        if (convertOnly.isChecked) return ForgeMatrix()
        return ForgeMatrix(
            enabled = matrixCheck.isChecked && branches.isNotEmpty(),
            mode = MergeMode.entries[mergeSpinner.selectedItemPosition.coerceIn(0, MergeMode.entries.lastIndex)],
            branches = branches.toList(),
            master = stack.toList()
        )
    }

    private fun updateAllLabels() {
        if (::stackText.isInitialized) {
            stackText.text = if (stack.isEmpty()) "Working chain empty" else stack.mapIndexed { i, t ->
                "${i + 1}. ${t.kind.title} • FULL"
            }.joinToString("\n")
        }
        if (::branchText.isInitialized) {
            branchText.text = if (branches.isEmpty()) "No parallel copies" else branches.mapIndexed { index, branch ->
                val side = if (::mergeSpinner.isInitialized && MergeMode.entries[mergeSpinner.selectedItemPosition] == MergeMode.STEREO_SIDE_BY_SIDE) {
                    if (index % 2 == 0) "LEFT" else "RIGHT"
                } else "MERGE"
                "${index + 1}. $side • ${branch.transforms.joinToString(" → ") { it.kind.title }} • FULL"
            }.joinToString("\n")
        }
        if (::waveLegendText.isInitialized && ::visualizer.isInitialized) {
            val labels = activeWaveLabels(currentMatrix())
            waveLegendText.text = "Active methods: " + labels.joinToString(" • ")
            visualizer.setWaveLabels(labels)
        }
    }

    private fun activeWaveLabels(matrix: ForgeMatrix): List<String> {
        if (convertOnly.isChecked) return listOf("CONVERT ONLY")
        val result = mutableListOf<String>()
        if (matrix.enabled) {
            matrix.branches.forEachIndexed { index, branch ->
                val prefix = if (matrix.mode == MergeMode.STEREO_SIDE_BY_SIDE) {
                    if (index % 2 == 0) "L" else "R"
                } else "M${index + 1}"
                branch.transforms.forEach { result += "$prefix:${it.kind.title}" }
            }
            matrix.master.forEach { result += "MASTER:${it.kind.title}" }
        } else {
            matrix.master.forEach { result += it.kind.title }
        }
        return if (result.isEmpty()) listOf("DRY") else result
    }

    private fun showWaveInfo(kind: TransformKind) {
        val root = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            setPadding(dp(12), dp(8), dp(12), dp(8))
        }
        val body = TextView(this).apply {
            setTextColor(Color.WHITE)
            textSize = 14f
            setPadding(dp(8), dp(12), dp(8), dp(12))
        }
        fun show(tab: String) {
            body.text = when (tab) {
                "concept" -> "CATEGORY\n${kind.category.label}\n\n${kind.category.description}\n\nCONCEPT\n${kind.concept}"
                "dsp" -> "EXACT DIGITAL OPERATION\n${kind.dsp}\n\nThe method is applied as a complete fixed profile. There is no method-strength percentage."
                else -> "EVIDENCE / INTERPRETATION\n${kind.evidence}\n\nThis tab separates the measurable DSP from the historical or experimental interpretation."
            }
        }
        val tabs = LinearLayout(this).apply { orientation = LinearLayout.HORIZONTAL }
        tabs.addView(button("CONCEPT") { show("concept") }, LinearLayout.LayoutParams(0, dp(48), 1f))
        tabs.addView(button("DSP") { show("dsp") }, LinearLayout.LayoutParams(0, dp(48), 1f))
        tabs.addView(button("STATUS") { show("status") }, LinearLayout.LayoutParams(0, dp(48), 1f))
        root.addView(tabs)
        root.addView(body)
        show("concept")
        AlertDialog.Builder(this)
            .setTitle(kind.title)
            .setView(root)
            .setPositiveButton("CLOSE", null)
            .show()
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
            hint = "Paste SAF3: or older SAF2: code"
            minLines = 4
            setTextColor(Color.WHITE)
            setHintTextColor(Color.GRAY)
        }
        AlertDialog.Builder(this)
            .setTitle("Import Preset DNA")
            .setView(input)
            .setPositiveButton("IMPORT") { _, _ ->
                runCatching { PresetDna.decode(input.text.toString()) }
                    .onSuccess { applyState(it); dnaText.text = "Imported preset DNA"; toast("Preset DNA loaded") }
                    .onFailure { toast("DNA error: ${it.message}") }
            }
            .setNegativeButton("CANCEL", null)
            .show()
    }

    private fun applyState(state: PresetDna.State) {
        stack.clear()
        stack.addAll(state.stack)
        branches.clear()
        branches.addAll(state.matrix.branches)
        matrixCheck.isChecked = state.matrix.enabled && branches.isNotEmpty()
        mergeSpinner.setSelection(state.matrix.mode.ordinal)
        convertOnly.isChecked = stack.isEmpty() && branches.isEmpty()
        updateAllLabels()
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

    private fun chooseSingleDestination() {
        val source = sourceUri ?: return toast("Choose a single audio or video first")
        if (processing.get()) return toast("A processing job is already running")
        val format = selectedOutputFormat()
        pendingMatrix = currentMatrix()
        pendingFormat = format
        val sourceName = displayName(source)
        val stem = sourceName.substringBeforeLast('.', sourceName).ifBlank { "ScalarAudioForge" }
        val intent = Intent(Intent.ACTION_CREATE_DOCUMENT).apply {
            addCategory(Intent.CATEGORY_OPENABLE)
            type = format.mimeType
            putExtra(Intent.EXTRA_TITLE, "$stem-forge.${format.extension}")
            flags = Intent.FLAG_GRANT_READ_URI_PERMISSION or Intent.FLAG_GRANT_WRITE_URI_PERMISSION or Intent.FLAG_GRANT_PERSISTABLE_URI_PERMISSION
        }
        startActivityForResult(intent, pickSingleDestination)
    }

    private fun chooseBatchFolder() {
        if (batchUris.isEmpty()) return toast("Import a batch first")
        if (processing.get()) return toast("A processing job is already running")
        val intent = Intent(Intent.ACTION_OPEN_DOCUMENT_TREE).apply {
            flags = Intent.FLAG_GRANT_READ_URI_PERMISSION or Intent.FLAG_GRANT_WRITE_URI_PERMISSION or Intent.FLAG_GRANT_PERSISTABLE_URI_PERMISSION
        }
        startActivityForResult(intent, pickBatchFolder)
    }

    private fun processSingleTo(destination: Uri, matrix: ForgeMatrix, format: OutputFormat) {
        val source = sourceUri ?: return
        if (!processing.compareAndSet(false, true)) return toast("A processing job is already running")
        stopPlayer()
        visualizer.clearHistory()
        visualizer.setWaveLabels(activeWaveLabels(matrix))
        progress.progress = 0
        statusText.text = "Direct streaming • decoder → DSP → destination"
        window.addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON)

        executor.execute {
            runCatching {
                AudioPipeline.process(this, source, destination, matrix, format) { p, preview ->
                    runOnUiThread {
                        progress.progress = (p * 1000).toInt()
                        if (preview != null) visualizer.appendSamples(preview)
                        statusText.text = "Processing progress ${(p * 100).toInt()}% • direct-save mode"
                    }
                }
            }.onSuccess { result ->
                processedUri = result.uri
                processedFormat = result.format
                runOnUiThread {
                    finishProcessing()
                    progress.progress = 1000
                    statusText.text = "Saved • ${result.sampleRate} Hz • ${result.channels} ch • ${result.format.label}"
                    toast("Processing complete and already saved")
                }
            }.onFailure { error ->
                runCatching { DocumentsContract.deleteDocument(contentResolver, destination) }
                runOnUiThread {
                    finishProcessing()
                    statusText.text = "Processing error: ${error.message ?: error.javaClass.simpleName}"
                }
            }
        }
    }

    private fun runBatch(treeUri: Uri) {
        if (!processing.compareAndSet(false, true)) return toast("A processing job is already running")
        val sources = batchUris.toList()
        val matrix = currentMatrix()
        val format = selectedOutputFormat()
        visualizer.clearHistory()
        visualizer.setWaveLabels(activeWaveLabels(matrix))
        progress.progress = 0
        window.addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON)

        executor.execute {
            var completed = 0
            var failed = 0
            for ((index, uri) in sources.withIndex()) {
                val inputName = displayName(uri)
                val stem = inputName.substringBeforeLast('.', inputName).ifBlank { "forge_${index + 1}" }
                var outUri: Uri? = null
                try {
                    outUri = createDocumentInTree(treeUri, format.mimeType, "$stem-forge.${format.extension}")
                    AudioPipeline.process(this, uri, outUri, matrix, format) { p, preview ->
                        val global = (index + p) / sources.size.toFloat()
                        runOnUiThread {
                            progress.progress = (global * 1000).toInt()
                            if (preview != null) visualizer.appendSamples(preview)
                            statusText.text = "Batch ${index + 1}/${sources.size} • progress ${(p * 100).toInt()}% • $inputName"
                        }
                    }
                    completed++
                } catch (_: Throwable) {
                    failed++
                    outUri?.let { failedUri -> runCatching { DocumentsContract.deleteDocument(contentResolver, failedUri) } }
                }
            }
            runOnUiThread {
                finishProcessing()
                progress.progress = 1000
                statusText.text = "Batch finished • $completed saved • $failed failed"
                toast("Batch complete")
            }
        }
    }

    private fun finishProcessing() {
        processing.set(false)
        window.clearFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON)
    }

    private fun createDocumentInTree(treeUri: Uri, mime: String, name: String): Uri {
        val documentId = DocumentsContract.getTreeDocumentId(treeUri)
        val parent = DocumentsContract.buildDocumentUriUsingTree(treeUri, documentId)
        return DocumentsContract.createDocument(contentResolver, parent, mime, name)
            ?: error("Selected folder could not create $name")
    }

    private fun playOriginal() {
        val uri = sourceUri ?: return toast("Choose a source first")
        playUri(uri)
    }

    private fun playProcessed() {
        val uri = processedUri ?: return toast("Process and save a single result first")
        playUri(uri)
    }

    private fun playUri(uri: Uri) {
        stopPlayer()
        player = MediaPlayer().apply {
            setDataSource(this@MainActivity, uri)
            setOnPreparedListener { it.start() }
            setOnCompletionListener { stopPlayer() }
            setOnErrorListener { _, _, _ -> stopPlayer(); true }
            prepareAsync()
        }
    }

    override fun onActivityResult(requestCode: Int, resultCode: Int, data: Intent?) {
        super.onActivityResult(requestCode, resultCode, data)
        if (resultCode != RESULT_OK) return
        when (requestCode) {
            pickAudio -> data?.data?.let { uri ->
                persistRead(uri)
                sourceUri = uri
                val size = sourceSize(uri)
                fileText.text = buildString {
                    append(displayName(uri))
                    if (size >= 0L) append(" • ").append(formatBytes(size))
                    append("\nDirect-save mode prevents a second giant cache copy.")
                }
                statusText.text = "Single source ready"
            }
            pickBatch -> {
                val collected = mutableListOf<Uri>()
                data?.clipData?.let { clip -> for (i in 0 until clip.itemCount) collected += clip.getItemAt(i).uri }
                if (collected.isEmpty()) data?.data?.let { collected += it }
                collected.forEach { persistRead(it) }
                batchUris.clear()
                batchUris.addAll(collected.distinct())
                batchText.text = if (batchUris.isEmpty()) "Batch empty" else "${batchUris.size} files ready • direct-to-folder streaming"
                statusText.text = "Batch ready"
            }
            pickBatchFolder -> data?.data?.let { tree ->
                val flags = Intent.FLAG_GRANT_READ_URI_PERMISSION or Intent.FLAG_GRANT_WRITE_URI_PERMISSION
                runCatching { contentResolver.takePersistableUriPermission(tree, flags) }
                runBatch(tree)
            }
            pickSingleDestination -> data?.data?.let { destination ->
                val flags = Intent.FLAG_GRANT_READ_URI_PERMISSION or Intent.FLAG_GRANT_WRITE_URI_PERMISSION
                runCatching { contentResolver.takePersistableUriPermission(destination, flags) }
                val matrix = pendingMatrix ?: currentMatrix()
                val format = pendingFormat ?: selectedOutputFormat()
                pendingMatrix = null
                pendingFormat = null
                processSingleTo(destination, matrix, format)
            }
        }
    }

    private fun persistRead(uri: Uri) {
        runCatching { contentResolver.takePersistableUriPermission(uri, Intent.FLAG_GRANT_READ_URI_PERMISSION) }
    }

    private fun promptSavePreset() {
        val state = PresetDna.State(stack.toList(), currentMatrix())
        if (state.stack.isEmpty() && state.matrix.branches.isEmpty()) return toast("Build a method chain or Matrix first")
        val input = EditText(this).apply {
            hint = "Preset name"
            setTextColor(Color.WHITE)
            setHintTextColor(Color.GRAY)
        }
        AlertDialog.Builder(this)
            .setTitle("Save complete custom preset")
            .setView(input)
            .setPositiveButton("SAVE") { _, _ ->
                val name = input.text.toString().trim()
                if (name.isNotEmpty()) {
                    store.save(name, state)
                    refreshSaved()
                    toast("Complete routing preset saved")
                }
            }
            .setNegativeButton("CANCEL", null)
            .show()
    }

    private fun refreshSaved() {
        if (!::savedSpinner.isInitialized) return
        val names = store.names()
        savedSpinner.adapter = darkAdapter(if (names.isEmpty()) listOf("No saved presets") else names)
    }

    private fun loadSaved() {
        val name = savedSpinner.selectedItem?.toString() ?: return
        if (name == "No saved presets") return
        applyState(store.load(name))
        descriptionText.text = "Custom full-routing preset: $name"
        toast("Preset loaded")
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

    private fun sourceSize(uri: Uri): Long {
        contentResolver.query(uri, arrayOf(OpenableColumns.SIZE), null, null, null)?.use { cursor ->
            if (cursor.moveToFirst() && !cursor.isNull(0)) return cursor.getLong(0)
        }
        return -1L
    }

    private fun formatBytes(bytes: Long): String {
        if (bytes < 1024L) return "$bytes B"
        val units = arrayOf("KB", "MB", "GB", "TB")
        var value = bytes.toDouble()
        var unit = -1
        while (value >= 1024.0 && unit < units.lastIndex) {
            value /= 1024.0
            unit++
        }
        return String.format(Locale.US, "%.2f %s", value, units[unit.coerceAtLeast(0)])
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
