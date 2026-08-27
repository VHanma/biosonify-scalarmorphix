package com.vhanma.scalaraudioforge

import android.content.Context
import android.graphics.Canvas
import android.graphics.Color
import android.graphics.Paint
import android.util.AttributeSet
import android.view.View
import kotlin.math.PI
import kotlin.math.sin

class WaveDiagramView @JvmOverloads constructor(context: Context, attrs: AttributeSet? = null) : View(context, attrs) {
    private val line=Paint(Paint.ANTI_ALIAS_FLAG).apply{strokeWidth=3f;style=Paint.Style.STROKE}
    private val thin=Paint(Paint.ANTI_ALIAS_FLAG).apply{strokeWidth=2f;style=Paint.Style.STROKE}
    private val text=Paint(Paint.ANTI_ALIAS_FLAG).apply{color=Color.WHITE;textSize=24f}
    private val small=Paint(Paint.ANTI_ALIAS_FLAG).apply{color=Color.LTGRAY;textSize=20f}
    private var method=TransformKind.PUHARICH_8
    fun setMethod(kind:TransformKind){method=kind;invalidate()}
    override fun onDraw(canvas:Canvas){
        super.onDraw(canvas);canvas.drawColor(Color.rgb(15,18,26));val color=MethodCatalog.familyColor(method.category);line.color=color;thin.color=Color.rgb(130,138,158);val profile=MethodCatalog.profile(method)
        canvas.drawText("${MethodCatalog.familySymbol(method.category)}  ${method.title}",14f,30f,text);canvas.drawText(method.category.label,14f,55f,small)
        val y=height*0.58f;val left0=16f;val left1=width*0.30f;val right0=width*0.58f;val right1=width-16f
        drawWave(canvas,left0,left1,y,22f,3.2,thin);canvas.drawText("SOURCE",left0,y-38f,small);drawArrow(canvas,width*0.34f,y,width*0.53f,y,color)
        when(profile.diagramType){
            DiagramType.ENVELOPE->{drawModulatedWave(canvas,right0,right1,y,color,2.6,1.1);drawEnvelope(canvas,right0,right1,y,color);canvas.drawText("ENVELOPE",right0,y-42f,small)}
            DiagramType.CARRIER->{drawWave(canvas,right0,right1,y,24f,8.0,line);drawWave(canvas,right0,right1,y,10f,22.0,thin);canvas.drawText("SOURCE + CARRIER",right0,y-42f,small)}
            DiagramType.STEREO_PAIR->{canvas.drawText("L",right0-22f,y-28f,small);canvas.drawText("R",right0-22f,y+48f,small);drawWave(canvas,right0,right1,y-24f,15f,7.0,line);drawWave(canvas,right0,right1,y+30f,15f,7.3,line)}
            DiagramType.HARMONICS,DiagramType.LADDER->{drawWave(canvas,right0,right1,y-24f,10f,4.0,line);drawWave(canvas,right0,right1,y,10f,8.0,line);drawWave(canvas,right0,right1,y+24f,10f,12.0,line);canvas.drawText("HARMONIC LAYERS",right0,y-48f,small)}
            DiagramType.PHASE_ROTATE->{drawWave(canvas,right0,right1,y-20f,18f,5.0,line);drawWave(canvas,right0,right1,y+20f,18f,5.0,thin,PI/2);drawCurvedHint(canvas,right0+12f,y,right1-12f,color)}
            DiagramType.OPPOSED->{drawWave(canvas,right0,right1,y-20f,18f,5.0,line);drawWave(canvas,right0,right1,y+20f,18f,5.0,line,PI);canvas.drawText("+PHASE",right0,y-44f,small);canvas.drawText("−PHASE",right0,y+62f,small)}
            DiagramType.STANDING->{drawModulatedWave(canvas,right0,right1,y,color,7.0,2.0);canvas.drawText("NODES  ↕  ANTINODES",right0,y-42f,small)}
            DiagramType.REVERSE_PAIR->{drawArrow(canvas,right0,y-18f,right1,y-18f,color);drawArrow(canvas,right1,y+22f,right0,y+22f,color);canvas.drawText("FORWARD",right0,y-38f,small);canvas.drawText("REVERSED COPY",right0,y+58f,small)}
            DiagramType.SWEEP->{drawSweep(canvas,right0,right1,y,color);canvas.drawText("20 → 200 Hz SWEEP",right0,y-42f,small)}
            DiagramType.CHIRP->{drawSweep(canvas,right0,right1,y,color,true);canvas.drawText("CHIRP / SPREAD",right0,y-42f,small)}
            DiagramType.CENTER->{canvas.drawText("L",right0,y-30f,small);canvas.drawText("R",right0,y+42f,small);drawArrow(canvas,right0+28f,y-28f,right1-18f,y,color);drawArrow(canvas,right0+28f,y+28f,right1-18f,y,color);canvas.drawText("CENTER",right1-92f,y-18f,small)}
            DiagramType.CODED->{drawWave(canvas,right0,right1,y+12f,17f,8.0,line);drawCode(canvas,right0,right1,y-30f,color);canvas.drawText("CODE → CARRIER",right0,y-52f,small)}
        }
        if(profile.frequencies.isNotEmpty()){val f=profile.frequencies.joinToString(" / "){v->if(v%1.0==0.0)"${v.toInt()}" else "%.2f".format(v)};canvas.drawText("Key DSP frequencies: $f Hz",14f,height-16f,small)}
    }
    private fun drawWave(canvas:Canvas,x0:Float,x1:Float,y:Float,amp:Float,cycles:Double,paint:Paint,phase:Double=0.0){var px=x0;var py=y;val steps=120;for(i in 0..steps){val t=i.toDouble()/steps;val x=x0+(x1-x0)*t.toFloat();val yy=y-(sin(2.0*PI*cycles*t+phase)*amp).toFloat();if(i>0)canvas.drawLine(px,py,x,yy,paint);px=x;py=yy}}
    private fun drawModulatedWave(canvas:Canvas,x0:Float,x1:Float,y:Float,color:Int,carrierCycles:Double,envelopeCycles:Double){line.color=color;var px=x0;var py=y;val steps=140;for(i in 0..steps){val t=i.toDouble()/steps;val env=0.25+0.75*(0.5+0.5*sin(2.0*PI*envelopeCycles*t));val yy=y-(sin(2.0*PI*carrierCycles*t)*25.0*env).toFloat();val x=x0+(x1-x0)*t.toFloat();if(i>0)canvas.drawLine(px,py,x,yy,line);px=x;py=yy}}
    private fun drawEnvelope(canvas:Canvas,x0:Float,x1:Float,y:Float,color:Int){thin.color=color;var px=x0;var py=y-30f;for(i in 0..80){val t=i/80.0;val x=x0+(x1-x0)*t.toFloat();val yy=y-(12.0+18.0*(0.5+0.5*sin(2.0*PI*t))).toFloat();if(i>0)canvas.drawLine(px,py,x,yy,thin);px=x;py=yy}}
    private fun drawArrow(canvas:Canvas,x0:Float,y0:Float,x1:Float,y1:Float,color:Int){thin.color=color;canvas.drawLine(x0,y0,x1,y1,thin);val dx=x1-x0;val dy=y1-y0;val len=kotlin.math.sqrt(dx*dx+dy*dy).coerceAtLeast(1f);val ux=dx/len;val uy=dy/len;val px=-uy;val py=ux;val s=9f;canvas.drawLine(x1,y1,x1-ux*s+px*s*0.5f,y1-uy*s+py*s*0.5f,thin);canvas.drawLine(x1,y1,x1-ux*s-px*s*0.5f,y1-uy*s-py*s*0.5f,thin)}
    private fun drawCurvedHint(canvas:Canvas,x0:Float,y:Float,x1:Float,color:Int){thin.color=color;canvas.drawArc(x0,y-34f,x1,y+34f,-160f,140f,false,thin)}
    private fun drawSweep(canvas:Canvas,x0:Float,x1:Float,y:Float,color:Int,risingOnly:Boolean=false){line.color=color;var phase=0.0;var px=x0;var py=y;for(i in 0..150){val t=i/150.0;val freq=if(risingOnly)1.0+10.0*t else 2.0+8.0*(0.5+0.5*sin(PI*t));phase+=2.0*PI*freq/150.0;val x=x0+(x1-x0)*t.toFloat();val yy=y-(sin(phase)*22.0).toFloat();if(i>0)canvas.drawLine(px,py,x,yy,line);px=x;py=yy}}
    private fun drawCode(canvas:Canvas,x0:Float,x1:Float,y:Float,color:Int){thin.color=color;val bits=intArrayOf(1,0,1,1,0,0,1,0,1,0,0,1);val w=(x1-x0)/bits.size;var px=x0;var py=y+if(bits[0]==1)-10f else 10f;for(i in bits.indices){val yy=y+if(bits[i]==1)-10f else 10f;canvas.drawLine(px,py,px,yy,thin);canvas.drawLine(px,yy,px+w,yy,thin);px+=w;py=yy}}
}
