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
    private companion object {
        const val PICK_AUDIO = 1001
        const val PICK_BATCH = 1002
        const val PICK_BATCH_FOLDER = 1003
        const val PICK_SINGLE_DESTINATION = 1004
    }

    private var sourceUri: Uri? = null
    private val batchUris = mutableListOf<Uri>()
    private var processedUri: Uri? = null
    private var player: MediaPlayer? = null

    private val executor = Executors.newSingleThreadExecutor()
    private val processing = AtomicBoolean(false)
    private val cancelRequested = AtomicBoolean(false)

    private lateinit var store: PresetStore
    private lateinit var notebook: ExperimentNotebook

    private val stack = mutableListOf<TransformSpec>()
    private val branches = mutableListOf<ForgeBranch>()
    private val visiblePresets = mutableListOf<ForgePreset>()
    private val visibleKinds = mutableListOf<TransformKind>()

    private var pendingMatrix: ForgeMatrix? = null
    private var pendingFormat: OutputFormat? = null
    private var pairIndex = 0

    private lateinit var fileText: TextView
    private lateinit var batchText: TextView
    private lateinit var descriptionText: TextView
    private lateinit var stackText: TextView
    private lateinit var branchText: TextView
    private lateinit var dnaText: TextView
    private lateinit var waveLegendText: TextView
    private lateinit var statusText: TextView
    private lateinit var comboCounterText: TextView
    private lateinit var comboReportText: TextView
    private lateinit var notebookText: TextView

    private lateinit var progress: ProgressBar
    private lateinit var visualizer: WaveformView
    private lateinit var waveDiagram: WaveDiagramView
    private lateinit var comboDiagram: RoutingDiagramView
    private lateinit var radar: ExpectationRadarView

    private lateinit var presetCategorySpinner: Spinner
    private lateinit var quickSpinner: Spinner
    private lateinit var waveCategorySpinner: Spinner
    private lateinit var transformSpinner: Spinner
    private lateinit var savedSpinner: Spinner
    private lateinit var outputSpinner: Spinner
    private lateinit var mergeSpinner: Spinner
    private lateinit var comboASpinner: Spinner
    private lateinit var comboBSpinner: Spinner
    private lateinit var convertOnly: CheckBox
    private lateinit var matrixCheck: CheckBox

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        store = PresetStore(this)
        notebook = ExperimentNotebook(this)
        setContentView(buildUi())
        refreshPresetList()
        refreshWaveList()
        refreshSaved()
        refreshNotebook()
        visiblePresets.firstOrNull()?.let(::applyPresetFullChain)
        showPair(0)
    }

    private fun buildUi(): View {
        val scroll = ScrollView(this).apply {
            setBackgroundColor(Color.rgb(9, 11, 16))
        }
        val root = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            setPadding(dp(18), dp(34), dp(18), dp(46))
        }
        scroll.addView(root)

        root.addView(title("SCALAR AUDIO FORGE 1.3", 27f))
        root.addView(label("Converter + visual wave encyclopedia + full-method Matrix + complete Combo Atlas", 14f, muted()))
        root.addView(label("AUTO HUGE-FILE SAFE MODE • direct destination streaming • automatic RF64 promotion", 12f, accentGreen()))

        addSourceSection(root)
        addQuickComboSection(root)
        addWaveLibrarySection(root)
        addWorkingChainSection(root)
        addMatrixSection(root)
        addComboAtlasSection(root)
        addPresetDnaSection(root)
        addAnalyzerSection(root)
        addExportSection(root)
        addNotebookSection(root)
        addHelpSection(root)

        return scroll
    }

    private fun addSourceSection(root: LinearLayout) {
        root.addView(section("SOURCE"))
        root.addView(button("IMPORT SINGLE AUDIO / VIDEO") { openSource() })
        fileText = label("No single source selected", 14f, Color.LTGRAY)
        root.addView(fileText)

        root.addView(button("IMPORT BATCH") { openBatch() })
        batchText = label("Batch empty", 13f, muted())
        root.addView(batchText)

        convertOnly = CheckBox(this).apply {
            text = "Convert Only • bypass experimental DSP"
            setTextColor(Color.WHITE)
            setOnCheckedChangeListener { _, _ -> updateAllLabels() }
        }
        root.addView(convertOnly)
    }

    private fun addQuickComboSection(root: LinearLayout) {
        root.addView(section("QUICK COMBOS • FULL METHODS"))

        presetCategorySpinner = Spinner(this).apply {
            adapter = darkAdapter(PresetCategory.entries.map { it.label })
            onItemSelectedListener = selectionListener { refreshPresetList() }
        }
        root.addView(presetCategorySpinner, fullHeight(50))

        quickSpinner = Spinner(this).apply {
            onItemSelectedListener = selectionListener { showSelectedPresetDescription() }
        }
        root.addView(quickSpinner, fullHeight(50))

        descriptionText = label("Choose a combo", 13f, Color.rgb(193, 197, 213))
        root.addView(descriptionText)

        root.addView(button("APPLY AS FULL CHAIN") {
            selectedPreset()?.let(::applyPresetFullChain)
        })
        root.addView(button("APPLY AS FULL MERGE") {
            selectedPreset()?.let { applyPresetParallel(it, MergeMode.FULL_MERGE) }
        })
        root.addView(button("APPLY SIDE-BY-SIDE") {
            selectedPreset()?.let { applyPresetParallel(it, MergeMode.STEREO_SIDE_BY_SIDE) }
        })

        root.addView(label(
            "FULL CHAIN = A → B → C. FULL MERGE = independent full copies combined. SIDE-BY-SIDE = independent full copies on L/R. No fake method-percentage controls.",
            12f,
            Color.GRAY
        ))
    }

    private fun addWaveLibrarySection(root: LinearLayout) {
        root.addView(section("WAVE LIBRARY • MINI VISUAL + INFO"))

        waveCategorySpinner = Spinner(this).apply {
            adapter = darkAdapter(WaveCategory.entries.map { it.label })
            onItemSelectedListener = selectionListener { refreshWaveList() }
        }
        root.addView(waveCategorySpinner, fullHeight(50))

        transformSpinner = Spinner(this).apply {
            onItemSelectedListener = selectionListener { updateSelectedWaveVisual() }
        }
        root.addView(transformSpinner, fullHeight(50))

        waveDiagram = WaveDiagramView(this)
        root.addView(waveDiagram, fullHeight(220))

        val row = LinearLayout(this).apply { orientation = LinearLayout.HORIZONTAL }
        row.addView(button("INFO TABS") {
            selectedKind()?.let(::showWaveInfo)
        }, weightedHeight(50))
        row.addView(button("+ ADD FULL METHOD") {
            addSelectedMethod()
        }, weightedHeight(50))
        root.addView(row)

        root.addView(button("SOLO SELECTED METHOD") {
            selectedKind()?.let(::soloMethod)
        })

        root.addView(label(
            "Each mini diagram is generated from the same method definition used by the app. Arrows show source → operation → result, including envelopes, carriers, stereo lanes, phase opposition, chirps, center projection, and reverse copies.",
            12f,
            accentGreen()
        ))
    }

    private fun addWorkingChainSection(root: LinearLayout) {
        root.addView(section("WORKING FULL-METHOD CHAIN"))
        stackText = label("Chain empty", 13f, Color.rgb(156, 124, 255))
        root.addView(stackText)

        val row = LinearLayout(this).apply { orientation = LinearLayout.HORIZONTAL }
        row.addView(button("REMOVE LAST") {
            if (stack.isNotEmpty()) stack.removeAt(stack.lastIndex)
            updateAllLabels()
        }, weightedHeight(48))
        row.addView(button("CLEAR") {
            stack.clear()
            updateAllLabels()
        }, weightedHeight(48))
        root.addView(row)

        root.addView(button("SAVE COMPLETE CUSTOM PRESET") { promptSavePreset() })
        savedSpinner = Spinner(this)
        root.addView(savedSpinner, fullHeight(50))

        val savedRow = LinearLayout(this).apply { orientation = LinearLayout.HORIZONTAL }
        savedRow.addView(button("LOAD SAVED") { loadSaved() }, weightedHeight(48))
        savedRow.addView(button("DELETE") { deleteSaved() }, weightedHeight(48))
        root.addView(savedRow)
    }

    private fun addMatrixSection(root: LinearLayout) {
        root.addView(section("MATRIX LAB • FULL COPIES"))

        matrixCheck = CheckBox(this).apply {
            text = "Enable parallel-copy Matrix"
            setTextColor(Color.WHITE)
            setOnCheckedChangeListener { _, _ -> updateAllLabels() }
        }
        root.addView(matrixCheck)

        mergeSpinner = Spinner(this).apply {
            adapter = darkAdapter(MergeMode.entries.map { it.label })
            onItemSelectedListener = selectionListener { updateAllLabels() }
        }
        root.addView(mergeSpinner, fullHeight(52))

        root.addView(button("ADD CURRENT FULL CHAIN AS ONE BRANCH") { addCurrentBranch() })
        root.addView(button("SPLIT EACH CURRENT METHOD INTO ITS OWN FULL COPY") { splitStackIntoBranches() })

        val row = LinearLayout(this).apply { orientation = LinearLayout.HORIZONTAL }
        row.addView(button("REMOVE BRANCH") {
            if (branches.isNotEmpty()) branches.removeAt(branches.lastIndex)
            updateAllLabels()
        }, weightedHeight(48))
        row.addView(button("CLEAR MATRIX") {
            branches.clear()
            matrixCheck.isChecked = false
            updateAllLabels()
        }, weightedHeight(48))
        root.addView(row)

        branchText = label("No parallel copies", 13f, accentGreen())
        root.addView(branchText)
    }

    private fun addComboAtlasSection(root: LinearLayout) {
        root.addView(section("COMBINATION ATLAS • ALL 136 PAIRS + ANY N-WAY STACK"))

        comboASpinner = Spinner(this).apply {
            adapter = darkAdapter(TransformKind.entries.map { it.title })
        }
        root.addView(comboASpinner, fullHeight(50))

        comboBSpinner = Spinner(this).apply {
            adapter = darkAdapter(TransformKind.entries.map { it.title })
            setSelection(1)
        }
        root.addView(comboBSpinner, fullHeight(50))

        root.addView(button("ANALYZE SELECTED PAIR") { showChosenPair() })

        comboCounterText = label("Pair 1 / ${ComboEngine.allPairs.size}", 13f, accentGreen())
        root.addView(comboCounterText)

        val nav = LinearLayout(this).apply { orientation = LinearLayout.HORIZONTAL }
        nav.addView(button("◀ PREVIOUS") { showPair(pairIndex - 1) }, weightedHeight(46))
        nav.addView(button("NEXT ▶") { showPair(pairIndex + 1) }, weightedHeight(46))
        root.addView(nav)

        comboDiagram = RoutingDiagramView(this)
        root.addView(comboDiagram, fullHeight(220))

        radar = ExpectationRadarView(this)
        root.addView(radar, fullHeight(310))

        comboReportText = label("", 13f, Color.rgb(213, 216, 230))
        root.addView(comboReportText)
        root.addView(button("ANALYZE MY CURRENT BUILD") { showCurrentBuildAnalysis() })

        root.addView(label(
            "Every unique pair is generated from the method-trait model. Three or more methods are analyzed dynamically, so custom stacks are covered without hard-coding thousands of pages.",
            12f,
            Color.GRAY
        ))
    }

    private fun addPresetDnaSection(root: LinearLayout) {
        root.addView(section("PRESET DNA • REPRODUCIBLE RECIPE"))
        val row = LinearLayout(this).apply { orientation = LinearLayout.HORIZONTAL }
        row.addView(button("COPY DNA") { copyDna() }, weightedHeight(48))
        row.addView(button("IMPORT DNA") { promptImportDna() }, weightedHeight(48))
        root.addView(row)

        dnaText = label(
            "SAF3 stores exact full-method routing. Legacy SAF2 imports ignore old strength percentages.",
            12f,
            muted()
        )
        root.addView(dnaText)
    }

    private fun addAnalyzerSection(root: LinearLayout) {
        root.addView(section("ANALYZER • ORIGINAL / PROCESSED / DIFFERENCE"))
        waveLegendText = label("Active methods: Convert Only", 12f, Color.rgb(193, 197, 213))
        root.addView(waveLegendText)
        visualizer = WaveformView(this)
        root.addView(visualizer, fullHeight(560))
    }

    private fun addExportSection(root: LinearLayout) {
        root.addView(section("EXPORT ENGINE"))
        outputSpinner = Spinner(this).apply {
            adapter = darkAdapter(OutputFormat.entries.map { it.label })
        }
        root.addView(outputSpinner, fullHeight(52))

        root.addView(label(
            "For PCM output, the app estimates decoded size before processing. When normal RIFF WAV would approach its size ceiling, it automatically promotes to matching RF64 16-bit, 24-bit, or float32. AAC and Opus still depend on codecs exposed by the phone.",
            12f,
            Color.GRAY
        ))

        root.addView(button("PROCESS + SAVE DIRECTLY") { chooseSingleDestination() })
        root.addView(button("BATCH: CHOOSE OUTPUT FOLDER + RUN") { chooseBatchFolder() })
        root.addView(button("CANCEL CURRENT JOB") {
            if (processing.get()) {
                cancelRequested.set(true)
                statusText.text = "Cancelling safely after the current codec buffer…"
            }
        })

        progress = ProgressBar(this, null, android.R.attr.progressBarStyleHorizontal).apply {
            max = 1000
        }
        root.addView(progress, LinearLayout.LayoutParams(-1, dp(18)))

        statusText = label("Ready", 13f, accentGreen())
        root.addView(statusText)

        val row = LinearLayout(this).apply { orientation = LinearLayout.HORIZONTAL }
        row.addView(button("PLAY ORIGINAL") { playOriginal() }, weightedHeight(50))
        row.addView(button("PLAY SAVED RESULT") { playProcessed() }, weightedHeight(50))
        root.addView(row)
    }

    private fun addNotebookSection(root: LinearLayout) {
        root.addView(section("EXPERIMENT NOTEBOOK"))
        notebookText = label("No experiments saved yet", 12f, Color.rgb(193, 197, 213))
        root.addView(notebookText)
        root.addView(button("COPY LAST EXPERIMENT JSON") { copyLastExperiment() })
        root.addView(label(
            "Each successful single export records source, output format, routing, full methods, predicted combination behavior, and Preset DNA so the same experiment can be reconstructed later.",
            12f,
            Color.GRAY
        ))
    }

    private fun addHelpSection(root: LinearLayout) {
        root.addView(section("INSTALL / HELP"))
        root.addView(label(
            "If a third-party installer reports 'Caller has no access to session', its Android PackageInstaller session is stale or inaccessible. Open the APK from Files/Downloads and use Android's normal system package installer.",
            12f,
            Color.rgb(255, 196, 110)
        ))
        root.addView(label(
            "Labels such as scalar, longitudinal, Tesla, Meyl, Bearden, DNA, and Puharich identify experimental models or inspirations. The app separately states the exact measurable DSP operation. Audio DSP by itself does not establish exotic propagation or biological effects.",
            12f,
            Color.rgb(156, 160, 177)
        ))
    }

    private fun selectionListener(action: () -> Unit) = object : AdapterView.OnItemSelectedListener {
        override fun onItemSelected(parent: AdapterView<*>?, view: View?, position: Int, id: Long) {
            action()
        }
        override fun onNothingSelected(parent: AdapterView<*>?) = Unit
    }

    private fun refreshPresetList() {
        if (!::presetCategorySpinner.isInitialized || !::quickSpinner.isInitialized) return
        val category = PresetCategory.entries[presetCategorySpinner.selectedItemPosition.coerceIn(0, PresetCategory.entries.lastIndex)]
        visiblePresets.clear()
        visiblePresets.addAll(PresetLibrary.byCategory(category))
        quickSpinner.adapter = darkAdapter(
            if (visiblePresets.isEmpty()) listOf("No presets") else visiblePresets.map { it.name }
        )
        showSelectedPresetDescription()
    }

    private fun refreshWaveList() {
        if (!::waveCategorySpinner.isInitialized || !::transformSpinner.isInitialized) return
        val category = WaveCategory.entries[waveCategorySpinner.selectedItemPosition.coerceIn(0, WaveCategory.entries.lastIndex)]
        visibleKinds.clear()
        visibleKinds.addAll(TransformKind.entries.filter { it.category == category })
        transformSpinner.adapter = darkAdapter(
            if (visibleKinds.isEmpty()) listOf("No methods") else visibleKinds.map { it.title }
        )
        updateSelectedWaveVisual()
    }

    private fun selectedPreset(): ForgePreset? = visiblePresets.getOrNull(quickSpinner.selectedItemPosition)
    private fun selectedKind(): TransformKind? = visibleKinds.getOrNull(transformSpinner.selectedItemPosition)

    private fun updateSelectedWaveVisual() {
        selectedKind()?.let { kind ->
            if (::waveDiagram.isInitialized) waveDiagram.setMethod(kind)
        }
    }

    private fun showSelectedPresetDescription() {
        if (!::descriptionText.isInitialized) return
        val preset = selectedPreset()
        descriptionText.text = if (preset == null) {
            "No preset in this category"
        } else {
            buildString {
                append(preset.category.label).append(" • ").append(preset.name)
                append('\n').append(preset.description)
                if (preset.transforms.isNotEmpty()) {
                    append("\n\nFULL METHODS:\n")
                    preset.transforms.forEach { append("• ").append(it.kind.title).append('\n') }
                    val report = ComboEngine.analyze(preset.transforms.map { it.kind })
                    append("\nEXPECTED: ").append(report.summary)
                    append("\nRECOMMENDED: ").append(report.route.label)
                }
            }.trim()
        }
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

    private fun soloMethod(kind: TransformKind) {
        stack.clear()
        branches.clear()
        stack += TransformSpec(kind)
        matrixCheck.isChecked = false
        convertOnly.isChecked = false
        updateAllLabels()
        toast("Solo: ${kind.title}")
    }

    private fun addSelectedMethod() {
        selectedKind()?.let { kind ->
            stack += TransformSpec(kind)
            convertOnly.isChecked = false
            updateAllLabels()
        }
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
        stack.forEach { branches += ForgeBranch(it.kind.title, listOf(it)) }
        stack.clear()
        matrixCheck.isChecked = true
        convertOnly.isChecked = false
        updateAllLabels()
    }

    private fun currentMatrix(): ForgeMatrix {
        if (convertOnly.isChecked) return ForgeMatrix()
        val mode = MergeMode.entries[mergeSpinner.selectedItemPosition.coerceIn(0, MergeMode.entries.lastIndex)]
        return ForgeMatrix(
            enabled = matrixCheck.isChecked && branches.isNotEmpty(),
            mode = mode,
            branches = branches.toList(),
            master = stack.toList()
        )
    }

    private fun currentMethods(matrix: ForgeMatrix = currentMatrix()): List<TransformKind> {
        if (convertOnly.isChecked) return emptyList()
        val result = mutableListOf<TransformKind>()
        if (matrix.enabled) {
            matrix.branches.forEach { branch -> branch.transforms.forEach { result += it.kind } }
        }
        matrix.master.forEach { result += it.kind }
        return result.distinct()
    }

    private fun updateAllLabels() {
        if (::stackText.isInitialized) {
            stackText.text = if (stack.isEmpty()) {
                "Working chain empty"
            } else {
                stack.mapIndexed { index, transform ->
                    "${index + 1}. ${transform.kind.title} • FULL"
                }.joinToString("\n")
            }
        }

        if (::branchText.isInitialized) {
            branchText.text = if (branches.isEmpty()) {
                "No parallel copies"
            } else {
                val mode = if (::mergeSpinner.isInitialized) {
                    MergeMode.entries[mergeSpinner.selectedItemPosition.coerceIn(0, MergeMode.entries.lastIndex)]
                } else MergeMode.FULL_MERGE
                branches.mapIndexed { index, branch ->
                    val lane = if (mode == MergeMode.STEREO_SIDE_BY_SIDE) {
                        if (index % 2 == 0) "LEFT" else "RIGHT"
                    } else "MERGE"
                    "$lane • ${branch.transforms.joinToString(" → ") { it.kind.title }} • FULL"
                }.joinToString("\n")
            }
        }

        if (::waveLegendText.isInitialized && ::visualizer.isInitialized) {
            val labels = activeWaveLabels(currentMatrix())
            waveLegendText.text = "Active methods: ${labels.joinToString(" • ")}"
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
        val profile = MethodCatalog.profile(kind)
        val root = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            setPadding(dp(12), dp(8), dp(12), dp(8))
        }
        val diagram = WaveDiagramView(this).apply { setMethod(kind) }
        root.addView(diagram, fullHeight(220))

        val body = TextView(this).apply {
            setTextColor(Color.WHITE)
            textSize = 14f
            setPadding(dp(8), dp(12), dp(8), dp(12))
        }

        fun show(tab: String) {
            body.text = when (tab) {
                "concept" -> "CATEGORY\n${kind.category.label}\n\nCONCEPT\n${kind.concept}"
                "dsp" -> "EXACT DIGITAL OPERATION\n${kind.dsp}\n\nFULL means the complete defined method is applied. There is no percentage claiming how 'scalar' a signal is."
                "expect" -> "EXPECTED AUDIBLE / SIGNAL CHANGE\n${profile.expectedSound}"
                "best" -> "BEST USE\n${profile.bestUse}"
                "pair" -> "COMBINES WELL WITH\n${profile.combinesWell}"
                else -> "CONFLICTS / STATUS\n${profile.conflicts}\n\n${kind.evidence}"
            }
        }

        val row1 = LinearLayout(this).apply { orientation = LinearLayout.HORIZONTAL }
        row1.addView(button("CONCEPT") { show("concept") }, weightedHeight(44))
        row1.addView(button("DSP") { show("dsp") }, weightedHeight(44))
        row1.addView(button("EXPECT") { show("expect") }, weightedHeight(44))
        root.addView(row1)

        val row2 = LinearLayout(this).apply { orientation = LinearLayout.HORIZONTAL }
        row2.addView(button("BEST USE") { show("best") }, weightedHeight(44))
        row2.addView(button("PAIRINGS") { show("pair") }, weightedHeight(44))
        row2.addView(button("CONFLICTS") { show("conflict") }, weightedHeight(44))
        root.addView(row2)
        root.addView(body)
        show("concept")

        AlertDialog.Builder(this)
            .setTitle(kind.title)
            .setView(root)
            .setPositiveButton("CLOSE", null)
            .show()
    }

    private fun showPair(index: Int) {
        val pairs = ComboEngine.allPairs
        if (pairs.isEmpty()) return
        pairIndex = ((index % pairs.size) + pairs.size) % pairs.size
        val report = pairs[pairIndex]
        showComboReport(report)
        if (::comboASpinner.isInitialized) {
            comboASpinner.setSelection(report.methods[0].ordinal)
            comboBSpinner.setSelection(report.methods[1].ordinal)
        }
        if (::comboCounterText.isInitialized) {
            comboCounterText.text = "Pair ${pairIndex + 1} / ${pairs.size}"
        }
    }

    private fun showChosenPair() {
        val a = TransformKind.entries[comboASpinner.selectedItemPosition.coerceIn(0, TransformKind.entries.lastIndex)]
        var b = TransformKind.entries[comboBSpinner.selectedItemPosition.coerceIn(0, TransformKind.entries.lastIndex)]
        if (a == b) b = TransformKind.entries[(b.ordinal + 1) % TransformKind.entries.size]
        val report = ComboEngine.pair(a, b)
        val index = ComboEngine.allPairs.indexOfFirst { it.methods.toSet() == setOf(a, b) }
        if (index >= 0) pairIndex = index
        showComboReport(report)
        comboCounterText.text = "Pair ${pairIndex + 1} / ${ComboEngine.allPairs.size}"
    }

    private fun showCurrentBuildAnalysis() {
        val methods = currentMethods()
        val report = ComboEngine.analyze(methods)
        showComboReport(report)
        comboCounterText.text = if (methods.size <= 1) {
            "Current build • ${methods.size} method"
        } else {
            "Current build • ${methods.size} methods • dynamic N-way prediction"
        }
    }

    private fun showComboReport(report: ComboReport) {
        if (::comboDiagram.isInitialized) comboDiagram.setReport(report)
        if (::radar.isInitialized) radar.setScores(report.scores)
        if (::comboReportText.isInitialized) {
            comboReportText.text = buildString {
                append(report.title.ifBlank { "Convert Only" })
                append("\n\nEXPECTED\n").append(report.summary)
                append("\n\nWHY\n").append(report.why)
                append("\n\nRECOMMENDED ROUTE\n").append(report.route.label)
                append("\n\nCONFLICT METER\n").append(report.conflict.label)
                append(" • ").append(report.conflictReason)
                append("\n\nBEST USE\n").append(report.bestUse)
            }
        }
    }

    private fun copyDna() {
        val code = PresetDna.encode(PresetDna.State(stack.toList(), currentMatrix()))
        copyText("Scalar Audio Forge Preset DNA", code)
        dnaText.text = code
        toast("Preset DNA copied")
    }

    private fun promptImportDna() {
        val input = EditText(this).apply {
            hint = "Paste SAF3: or legacy SAF2: code"
            minLines = 4
            setTextColor(Color.WHITE)
            setHintTextColor(Color.GRAY)
        }
        AlertDialog.Builder(this)
            .setTitle("Import Preset DNA")
            .setView(input)
            .setPositiveButton("IMPORT") { _, _ ->
                runCatching { PresetDna.decode(input.text.toString()) }
                    .onSuccess {
                        applyState(it)
                        dnaText.text = "Imported preset DNA"
                        toast("Preset DNA loaded")
                    }
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
        startActivityForResult(intent, PICK_AUDIO)
    }

    private fun openBatch() {
        val intent = Intent(Intent.ACTION_OPEN_DOCUMENT).apply {
            addCategory(Intent.CATEGORY_OPENABLE)
            type = "*/*"
            putExtra(Intent.EXTRA_MIME_TYPES, arrayOf("audio/*", "video/*"))
            putExtra(Intent.EXTRA_ALLOW_MULTIPLE, true)
            flags = Intent.FLAG_GRANT_READ_URI_PERMISSION or Intent.FLAG_GRANT_PERSISTABLE_URI_PERMISSION
        }
        startActivityForResult(intent, PICK_BATCH)
    }

    private fun chooseSingleDestination() {
        val source = sourceUri ?: return toast("Choose a single audio or video first")
        if (processing.get()) return toast("A processing job is already running")

        val matrix = currentMatrix()
        val requested = selectedOutputFormat()
        val safe = runCatching {
            AudioPipeline.chooseSafeOutput(requested, AudioPipeline.inspect(this, source), matrix)
        }.getOrElse { requested }

        pendingMatrix = matrix
        pendingFormat = safe
        if (safe != requested) {
            statusText.text = "Huge file detected • auto-promoted ${requested.label} → ${safe.label}"
        }

        val sourceName = displayName(source)
        val stem = sourceName.substringBeforeLast('.', sourceName).ifBlank { "ScalarAudioForge" }
        val intent = Intent(Intent.ACTION_CREATE_DOCUMENT).apply {
            addCategory(Intent.CATEGORY_OPENABLE)
            type = safe.mimeType
            putExtra(Intent.EXTRA_TITLE, "$stem-forge.${safe.extension}")
            flags = Intent.FLAG_GRANT_READ_URI_PERMISSION or
                Intent.FLAG_GRANT_WRITE_URI_PERMISSION or
                Intent.FLAG_GRANT_PERSISTABLE_URI_PERMISSION
        }
        startActivityForResult(intent, PICK_SINGLE_DESTINATION)
    }

    private fun chooseBatchFolder() {
        if (batchUris.isEmpty()) return toast("Import a batch first")
        if (processing.get()) return toast("A processing job is already running")
        val intent = Intent(Intent.ACTION_OPEN_DOCUMENT_TREE).apply {
            flags = Intent.FLAG_GRANT_READ_URI_PERMISSION or
                Intent.FLAG_GRANT_WRITE_URI_PERMISSION or
                Intent.FLAG_GRANT_PERSISTABLE_URI_PERMISSION
        }
        startActivityForResult(intent, PICK_BATCH_FOLDER)
    }

    private fun processSingleTo(destination: Uri, matrix: ForgeMatrix, format: OutputFormat) {
        val source = sourceUri ?: return
        if (!processing.compareAndSet(false, true)) return toast("A processing job is already running")

        cancelRequested.set(false)
        stopPlayer()
        visualizer.clearHistory()
        visualizer.setWaveLabels(activeWaveLabels(matrix))
        progress.progress = 0
        statusText.text = "Direct streaming • decoder → full DSP → destination"
        window.addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON)

        val sourceName = displayName(source)
        val methodsSnapshot = currentMethods(matrix)
        val routeSnapshot = routeLabel(matrix)
        val dnaSnapshot = PresetDna.encode(PresetDna.State(stack.toList(), matrix))

        executor.execute {
            runCatching {
                AudioPipeline.process(
                    context = this,
                    source = source,
                    destination = destination,
                    matrix = matrix,
                    outputFormat = format,
                    shouldCancel = { cancelRequested.get() }
                ) { p, preview ->
                    runOnUiThread {
                        progress.progress = (p * 1000).toInt()
                        preview?.let { visualizer.appendComparison(it.original, it.processed) }
                        statusText.text = "Processing progress ${(p * 100).toInt()}% • direct-save mode"
                    }
                }
            }.onSuccess { result ->
                processedUri = result.uri
                val report = ComboEngine.analyze(methodsSnapshot)
                notebook.add(
                    ExperimentNotebook.Record(
                        timestamp = System.currentTimeMillis(),
                        sourceName = sourceName,
                        outputLabel = result.format.label,
                        route = routeSnapshot,
                        methods = methodsSnapshot.map { it.title },
                        prediction = report.summary,
                        presetDna = dnaSnapshot
                    )
                )
                runOnUiThread {
                    finishProcessing()
                    refreshNotebook()
                    progress.progress = 1000
                    statusText.text = "Saved • ${result.sampleRate} Hz • ${result.channels} ch • ${result.format.label}"
                    toast("Processing complete and already saved")
                }
            }.onFailure { error ->
                runCatching { DocumentsContract.deleteDocument(contentResolver, destination) }
                runOnUiThread {
                    finishProcessing()
                    statusText.text = if (cancelRequested.get()) {
                        "Cancelled safely"
                    } else {
                        "Processing error: ${error.message ?: error.javaClass.simpleName}"
                    }
                }
            }
        }
    }

    private fun runBatch(treeUri: Uri) {
        if (!processing.compareAndSet(false, true)) return toast("A processing job is already running")

        cancelRequested.set(false)
        val sources = batchUris.toList()
        val matrix = currentMatrix()
        val requested = selectedOutputFormat()
        visualizer.clearHistory()
        visualizer.setWaveLabels(activeWaveLabels(matrix))
        progress.progress = 0
        window.addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON)

        executor.execute {
            var completed = 0
            var failed = 0

            for ((index, uri) in sources.withIndex()) {
                if (cancelRequested.get()) break
                val inputName = displayName(uri)
                val stem = inputName.substringBeforeLast('.', inputName).ifBlank { "forge_${index + 1}" }
                var outUri: Uri? = null

                try {
                    val format = runCatching {
                        AudioPipeline.chooseSafeOutput(requested, AudioPipeline.inspect(this, uri), matrix)
                    }.getOrElse { requested }
                    outUri = createDocumentInTree(treeUri, format.mimeType, "$stem-forge.${format.extension}")

                    AudioPipeline.process(
                        context = this,
                        source = uri,
                        destination = outUri,
                        matrix = matrix,
                        outputFormat = format,
                        shouldCancel = { cancelRequested.get() }
                    ) { p, preview ->
                        val global = (index + p) / sources.size.toFloat()
                        runOnUiThread {
                            progress.progress = (global * 1000).toInt()
                            preview?.let { visualizer.appendComparison(it.original, it.processed) }
                            statusText.text = "Batch ${index + 1}/${sources.size} • ${(p * 100).toInt()}% • $inputName"
                        }
                    }
                    completed++
                } catch (_: Throwable) {
                    if (!cancelRequested.get()) failed++
                    outUri?.let { runCatching { DocumentsContract.deleteDocument(contentResolver, it) } }
                }
            }

            runOnUiThread {
                finishProcessing()
                if (!cancelRequested.get()) progress.progress = 1000
                statusText.text = if (cancelRequested.get()) {
                    "Batch cancelled • $completed saved • $failed failed"
                } else {
                    "Batch finished • $completed saved • $failed failed"
                }
                toast(if (cancelRequested.get()) "Batch cancelled" else "Batch complete")
            }
        }
    }

    private fun createDocumentInTree(treeUri: Uri, mime: String, name: String): Uri {
        val documentId = DocumentsContract.getTreeDocumentId(treeUri)
        val parent = DocumentsContract.buildDocumentUriUsingTree(treeUri, documentId)
        return DocumentsContract.createDocument(contentResolver, parent, mime, name)
            ?: error("Selected folder could not create $name")
    }

    private fun routeLabel(matrix: ForgeMatrix): String {
        return if (convertOnly.isChecked) "Convert Only"
        else if (!matrix.enabled) "FULL CHAIN"
        else matrix.mode.label
    }

    private fun finishProcessing() {
        processing.set(false)
        cancelRequested.set(false)
        window.clearFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON)
    }

    private fun playOriginal() {
        sourceUri?.let(::playUri) ?: toast("Choose a source first")
    }

    private fun playProcessed() {
        processedUri?.let(::playUri) ?: toast("Process and save a single result first")
    }

    private fun playUri(uri: Uri) {
        stopPlayer()
        player = MediaPlayer().apply {
            setDataSource(this@MainActivity, uri)
            setOnPreparedListener { it.start() }
            setOnCompletionListener { stopPlayer() }
            setOnErrorListener { _, _, _ ->
                stopPlayer()
                true
            }
            prepareAsync()
        }
    }

    override fun onActivityResult(requestCode: Int, resultCode: Int, data: Intent?) {
        super.onActivityResult(requestCode, resultCode, data)
        if (resultCode != RESULT_OK) return

        when (requestCode) {
            PICK_AUDIO -> data?.data?.let { uri ->
                persistRead(uri)
                sourceUri = uri
                val size = sourceSize(uri)
                val info = runCatching { AudioPipeline.inspect(this, uri) }.getOrNull()
                fileText.text = buildString {
                    append(displayName(uri))
                    if (size >= 0L) append(" • ").append(formatBytes(size))
                    if (info != null) append("\n${info.sampleRate} Hz • ${info.channels} ch")
                    append("\nHuge-file safe mode will choose RF64 automatically when needed.")
                }
                statusText.text = "Single source ready"
            }

            PICK_BATCH -> {
                val collected = mutableListOf<Uri>()
                data?.clipData?.let { clip ->
                    for (i in 0 until clip.itemCount) collected += clip.getItemAt(i).uri
                }
                if (collected.isEmpty()) data?.data?.let { collected += it }
                collected.forEach(::persistRead)
                batchUris.clear()
                batchUris.addAll(collected.distinct())
                batchText.text = if (batchUris.isEmpty()) {
                    "Batch empty"
                } else {
                    "${batchUris.size} files ready • direct-to-folder streaming"
                }
                statusText.text = "Batch ready"
            }

            PICK_BATCH_FOLDER -> data?.data?.let { tree ->
                val flags = Intent.FLAG_GRANT_READ_URI_PERMISSION or Intent.FLAG_GRANT_WRITE_URI_PERMISSION
                runCatching { contentResolver.takePersistableUriPermission(tree, flags) }
                runBatch(tree)
            }

            PICK_SINGLE_DESTINATION -> data?.data?.let { destination ->
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
        runCatching {
            contentResolver.takePersistableUriPermission(uri, Intent.FLAG_GRANT_READ_URI_PERMISSION)
        }
    }

    private fun promptSavePreset() {
        val state = PresetDna.State(stack.toList(), currentMatrix())
        if (state.stack.isEmpty() && state.matrix.branches.isEmpty()) {
            return toast("Build a method chain or Matrix first")
        }

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

    private fun refreshNotebook() {
        if (!::notebookText.isInitialized) return
        val record = notebook.latest()
        notebookText.text = if (record == null) {
            "No experiments saved yet"
        } else {
            "Saved recipes: ${notebook.count()}\nLast: ${record.sourceName}\n${record.route}\n${record.methods.joinToString(" • ")}\n${record.prediction}"
        }
    }

    private fun copyLastExperiment() {
        val json = notebook.exportLatestJson()
        if (json == "{}") return toast("No experiment record yet")
        copyText("Scalar Audio Forge experiment", json)
        toast("Experiment JSON copied")
    }

    private fun copyText(label: String, text: String) {
        val clipboard = getSystemService(CLIPBOARD_SERVICE) as ClipboardManager
        clipboard.setPrimaryClip(ClipData.newPlainText(label, text))
    }

    private fun selectedOutputFormat(): OutputFormat {
        return OutputFormat.entries[outputSpinner.selectedItemPosition.coerceIn(0, OutputFormat.entries.lastIndex)]
    }

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
        cancelRequested.set(true)
        stopPlayer()
        executor.shutdownNow()
        super.onDestroy()
    }

    private fun darkAdapter(items: List<String>): ArrayAdapter<String> {
        return ArrayAdapter(this, android.R.layout.simple_spinner_dropdown_item, items)
    }

    private fun button(text: String, action: () -> Unit): Button {
        return Button(this).apply {
            this.text = text
            isAllCaps = false
            setTextColor(Color.WHITE)
            setBackgroundColor(Color.rgb(45, 36, 73))
            setOnClickListener { action() }
            gravity = Gravity.CENTER
        }
    }

    private fun label(text: String, size: Float, color: Int): TextView {
        return TextView(this).apply {
            this.text = text
            textSize = size
            setTextColor(color)
            setPadding(0, dp(4), 0, dp(6))
        }
    }

    private fun title(text: String, size: Float): TextView {
        return label(text, size, Color.WHITE).apply { setTypeface(typeface, 1) }
    }

    private fun section(text: String): TextView {
        return label(text, 16f, Color.rgb(156, 124, 255)).apply {
            setPadding(0, dp(22), 0, dp(8))
            setTypeface(typeface, 1)
        }
    }

    private fun fullHeight(height: Int) = LinearLayout.LayoutParams(-1, dp(height))
    private fun weightedHeight(height: Int) = LinearLayout.LayoutParams(0, dp(height), 1f)
    private fun dp(value: Int) = (value * resources.displayMetrics.density).toInt()
    private fun muted() = Color.rgb(170, 175, 194)
    private fun accentGreen() = Color.rgb(73, 210, 180)
    private fun toast(message: String) = Toast.makeText(this, message, Toast.LENGTH_SHORT).show()
}
