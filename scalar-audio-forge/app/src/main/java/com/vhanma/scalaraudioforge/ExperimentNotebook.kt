package com.vhanma.scalaraudioforge

import android.content.Context
import org.json.JSONArray
import org.json.JSONObject

class ExperimentNotebook(context:Context){
    data class Record(val timestamp:Long,val sourceName:String,val outputLabel:String,val route:String,val methods:List<String>,val prediction:String,val presetDna:String){fun toJson():JSONObject=JSONObject().put("timestamp",timestamp).put("source",sourceName).put("output",outputLabel).put("route",route).put("methods",JSONArray(methods)).put("prediction",prediction).put("presetDna",presetDna)}
    private val prefs=context.getSharedPreferences("forge_experiment_notebook",Context.MODE_PRIVATE)
    fun add(record:Record){val arr=readArray();val next=JSONArray().put(record.toJson());for(i in 0 until minOf(arr.length(),29))next.put(arr.getJSONObject(i));prefs.edit().putString("records",next.toString()).apply()}
    fun latest():Record?{val arr=readArray();if(arr.length()==0)return null;return fromJson(arr.optJSONObject(0)?:return null)}
    fun count()=readArray().length();fun exportLatestJson():String=latest()?.toJson()?.toString(2)?:"{}"
    private fun readArray():JSONArray=runCatching{JSONArray(prefs.getString("records","[]")?:"[]")}.getOrElse{JSONArray()}
    private fun fromJson(obj:JSONObject):Record{val methods=mutableListOf<String>();val arr=obj.optJSONArray("methods")?:JSONArray();for(i in 0 until arr.length())methods+=arr.optString(i);return Record(obj.optLong("timestamp"),obj.optString("source"),obj.optString("output"),obj.optString("route"),methods,obj.optString("prediction"),obj.optString("presetDna"))}
}
