case "right":

								fs[i] = \"right\";
								
break;

						}
					}
					temp.o.children().each((i,e)=>{
						
var s = e.id;
						for(
var f of fs){
							if(s.includes(f)){
								e.classList.remove(\"unfocus\");
								return;
							}
						}
						e.classList.add(\"unfocus\");
					});
				}
				/* action */
				
let trans_str = \"transform \"+temp.t+\"s linear\";
				if(temp.ac){
					
let pw = cmd_set.power ? 0 : cmd_set.power * mtpy;
					
let tm = cmd_set.times ? 0 : +cmd_set.times;
					
let rand = Number.isNaN(parseInt(cmd_set.random)) ? 90 : +cmd_set.random;
					temp.o1.css(\"transform-origin\",\"\");
					
switch (temp.ac) {

						case \"zoom\":
							pas.sx = cmd_set.xscale || cmd_set.scale || pas.sx;
							pas.sy = cmd_set.yscale || cmd_set.scale || pas.sy;
							if(cmd_set.poszoom && temp.o3[0]){
								
let [oriX,oriY] = cmd_set.poszoom.split(',');
								fun_msg(1,true,`[ZoomBefore]px: ${pas.px},py: ${pas.py}`);
								pas.px += (0.5-oriX)*pas.sx*temp.o3[0].width;
								pas.py += (oriY-0.5)*pas.sy*temp.o3[0].height;
								temp.o1.css(\"transform-origin\",\"center\");
								fun_msg(1,true,`[ZoomAfter]px: ${pas.px},py: ${pas.py}`);
							}
							
break;

						case \"jump\":
							
let et = tm <= 0 ? 0 : temp.t*1000/tm;
							for(
let i=0;i<temp.tm;i++)
							{
								setTimeout(() => {
									temp.o1.animate({\"top\":\"-=\"+pw},et/2,(o = temp.o1)=>{
										o.animate({\"top\":0},et/2);
									});
								}, et*i*1000);
							}
							trans_str = \"transform \"+temp.t+\"s ease-out\";
							
break;

						case \"shake\":
							
let n = \"shake_\" + temp.p;
							timer.clear(n);
							temp.o1.css({left:0,top:0});
							if(cmd_set.stop == \"true\"){
								temp.o1.removeAttr(\"d-sh-n\");
								temp.o1.removeAttr(\"d-sh-t\");
								
return 1;
							}
							temp.o1.attr({\"d-sh-n\":n,\"d-sh-t\":0});
							
let c = tm > 0 ? Math.max(Math.round(temp.t*1000/tm),1) : temp.t;
							timer.create(temp.n2,()=>timer_shake_common(temp.o1,pw,pw,rand,tm),c,true);
							
return 1;
						default:
							fun_msg(-1,true,\"< %s >Unexcepted type of %s\",match[1],temp.ac);
							
break;

					}
				}
				/* transform */
				temp.tst = [pas.sx,0,0,pas.sy,pas.px,pas.py];
				temp.o1[0].props = pas;
				fun_msg(1,true,\"<CharSlot>trans_from:\",temp.tsf,\"trans_to:\",temp.tst);
				temp.o1.css({transform:\"matrix(\"+temp.tsf.toString()+\")\"});
				/* opacity */
				if(Array.isArray(temp.a)){
					temp.o3.fadeTo(0,temp.a[0]);
					temp.o3.fadeTo(temp.t*1000,temp.a[1]);
				}
				else if(temp.a != \"unset\" && cmd_set.afrom === cmd_set.ato){
					temp.a = cmd_set.afrom;
					temp.o3.fadeTo(0,temp.a);
				}
				if(cmd_set.duration){
					timer.create(\"slot_si\",function(){temp.o1.css({transition:trans_str})},15);
				}
				timer.create(\"trans_slot\",function(){temp.o1.css({transform:\"matrix(\"+temp.tst.toString()+\")\"})},20);
				if(cmd_set.isblock == \"true\"){
					fun_delay(\"block\",temp.t,\"s\");
					
return 2;
				}
				
break;