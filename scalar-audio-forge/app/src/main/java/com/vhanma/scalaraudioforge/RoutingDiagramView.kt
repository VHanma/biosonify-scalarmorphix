package com.vhanma.scalaraudioforge

import android.content.Context
import android.graphics.Canvas
import android.graphics.Color
import android.graphics.Paint
import android.util.AttributeSet
import android.view.View

class RoutingDiagramView @JvmOverloads constructor(context:Context,attrs:AttributeSet?=null):View(context,attrs){
    private val line=Paint(Paint.ANTI_ALIAS_FLAG).apply{color=Color.rgb(156,124,255);strokeWidth=3f;style=Paint.Style.STROKE}
    private val box=Paint(Paint.ANTI_ALIAS_FLAG).apply{color=Color.rgb(45,36,73);style=Paint.Style.FILL}
    private val text=Paint(Paint.ANTI_ALIAS_FLAG).apply{color=Color.WHITE;textSize=20f}
    private val small=Paint(Paint.ANTI_ALIAS_FLAG).apply{color=Color.LTGRAY;textSize=17f}
    private var report=ComboEngine.analyze(emptyList())
    fun setReport(value:ComboReport){report=value;invalidate()}
    override fun onDraw(canvas:Canvas){super.onDraw(canvas);canvas.drawColor(Color.rgb(15,18,26));canvas.drawText(report.route.label,14f,26f,text);val methods=report.methods.take(4);if(methods.isEmpty()){canvas.drawText("DRY → OUTPUT",14f,height/2f,small);return};when(report.route){RecommendedRoute.FULL_CHAIN->drawChain(canvas,methods);RecommendedRoute.FULL_MERGE->drawMerge(canvas,methods);RecommendedRoute.SIDE_BY_SIDE->drawSide(canvas,methods)}}
    private fun drawChain(canvas:Canvas,methods:List<TransformKind>){val y=height*0.58f;var x=12f;drawBox(canvas,x,y-24f,x+70f,y+24f,"AUDIO");x+=80f;methods.forEach{kind->drawArrow(canvas,x,y,x+26f,y);x+=30f;val w=((width-120f)/methods.size).coerceAtMost(145f);drawBox(canvas,x,y-28f,x+w,y+28f,shortName(kind));x+=w+4f};if(x<width-70f){drawArrow(canvas,x,y,width-78f,y);drawBox(canvas,width-74f,y-24f,width-8f,y+24f,"OUT")}}
    private fun drawMerge(canvas:Canvas,methods:List<TransformKind>){val sourceX=12f;val sourceY=height/2f;drawBox(canvas,sourceX,sourceY-24f,sourceX+62f,sourceY+24f,"AUDIO");val targetX=width-74f;drawBox(canvas,targetX,sourceY-24f,width-8f,sourceY+24f,"OUT");val left=92f;val right=targetX-26f;methods.forEachIndexed{i,kind->val y=48f+i*((height-96f)/methods.size.coerceAtLeast(1));drawArrow(canvas,sourceX+62f,sourceY,left,y);drawBox(canvas,left,y-21f,right,y+21f,shortName(kind));drawArrow(canvas,right,y,targetX,sourceY)}}
    private fun drawSide(canvas:Canvas,methods:List<TransformKind>){val sourceX=12f;val sourceY=height/2f;drawBox(canvas,sourceX,sourceY-24f,sourceX+62f,sourceY+24f,"AUDIO");val splitX=96f;val leftY=height*0.34f;val rightY=height*0.68f;drawArrow(canvas,sourceX+62f,sourceY,splitX,leftY);drawArrow(canvas,sourceX+62f,sourceY,splitX,rightY);val a=methods.getOrNull(0);val b=methods.getOrNull(1)?:a;if(a!=null)drawBox(canvas,splitX,leftY-25f,width-90f,leftY+25f,"L: ${shortName(a)}");if(b!=null)drawBox(canvas,splitX,rightY-25f,width-90f,rightY+25f,"R: ${shortName(b)}");canvas.drawText("independent full copies",14f,height-12f,small)}
    private fun drawBox(canvas:Canvas,l:Float,t:Float,r:Float,b:Float,label:String){canvas.drawRoundRect(l,t,r,b,10f,10f,box);canvas.drawText(label.take(20),l+8f,(t+b)/2f+7f,small)}
    private fun drawArrow(canvas:Canvas,x0:Float,y0:Float,x1:Float,y1:Float){canvas.drawLine(x0,y0,x1,y1,line);val dx=x1-x0;val dy=y1-y0;val len=kotlin.math.sqrt(dx*dx+dy*dy).coerceAtLeast(1f);val ux=dx/len;val uy=dy/len;val px=-uy;val py=ux;val s=9f;canvas.drawLine(x1,y1,x1-ux*s+px*s*0.5f,y1-uy*s+py*s*0.5f,line);canvas.drawLine(x1,y1,x1-ux*s-px*s*0.5f,y1-uy*s-py*s*0.5f,line)}
    private fun shortName(kind:TransformKind)=kind.title.replace("Puharich ","").replace("Longitudinal ","Long. ").replace("Advanced / Retarded","Adv/Ret").replace("Information ","Info ")
}
