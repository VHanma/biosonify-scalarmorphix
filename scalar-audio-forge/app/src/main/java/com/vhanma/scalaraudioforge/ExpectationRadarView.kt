package com.vhanma.scalaraudioforge

import android.content.Context
import android.graphics.Canvas
import android.graphics.Color
import android.graphics.Paint
import android.graphics.Path
import android.util.AttributeSet
import android.view.View
import kotlin.math.PI
import kotlin.math.cos
import kotlin.math.min
import kotlin.math.sin

class ExpectationRadarView @JvmOverloads constructor(context:Context,attrs:AttributeSet?=null):View(context,attrs){
    private val grid=Paint(Paint.ANTI_ALIAS_FLAG).apply{color=Color.rgb(65,70,88);style=Paint.Style.STROKE;strokeWidth=1.5f}
    private val shape=Paint(Paint.ANTI_ALIAS_FLAG).apply{color=Color.rgb(156,124,255);style=Paint.Style.STROKE;strokeWidth=4f}
    private val point=Paint(Paint.ANTI_ALIAS_FLAG).apply{color=Color.rgb(73,210,180);style=Paint.Style.FILL}
    private val text=Paint(Paint.ANTI_ALIAS_FLAG).apply{color=Color.LTGRAY;textSize=19f}
    private var scores=ExpectationScores(0,0,0,0,0,0,0);private val labels=arrayOf("Rhythm","Harmonic","Spatial","Phase","Carrier","Temporal","Info")
    fun setScores(value:ExpectationScores){scores=value;invalidate()}
    override fun onDraw(canvas:Canvas){super.onDraw(canvas);canvas.drawColor(Color.rgb(15,18,26));val cx=width/2f;val cy=height/2f+4f;val radius=min(width,height)*0.32f;for(level in 1..5){val path=Path();for(i in labels.indices){val angle=-PI/2+i*2*PI/labels.size;val r=radius*level/5f;val x=cx+(cos(angle)*r).toFloat();val y=cy+(sin(angle)*r).toFloat();if(i==0)path.moveTo(x,y)else path.lineTo(x,y)};path.close();canvas.drawPath(path,grid)};for(i in labels.indices){val angle=-PI/2+i*2*PI/labels.size;val x=cx+(cos(angle)*radius).toFloat();val y=cy+(sin(angle)*radius).toFloat();canvas.drawLine(cx,cy,x,y,grid);val lx=cx+(cos(angle)*radius*1.25).toFloat()-22f;val ly=cy+(sin(angle)*radius*1.25).toFloat()+7f;canvas.drawText(labels[i],lx,ly,text)};val values=scores.values();val path=Path();for(i in values.indices){val angle=-PI/2+i*2*PI/values.size;val r=radius*values[i].coerceIn(0,5)/5f;val x=cx+(cos(angle)*r).toFloat();val y=cy+(sin(angle)*r).toFloat();if(i==0)path.moveTo(x,y)else path.lineTo(x,y);canvas.drawCircle(x,y,5f,point)};path.close();canvas.drawPath(path,shape)}
}
