case "shake":

						{
							
let n = \"action_\" + temp.n,tm = temp.tm,fd = temp.fd,pw = temp.pw;
							timer.clear(n);
							temp.o1.css({left:0,top:0});
							if(cmd_set.stop == \"true\"){
								temp.o1.removeAttr(\"d-sh-n\");
								temp.o1.removeAttr(\"d-sh-t\");
								
return 1;
							}
							temp.o1.attr({\"d-sh-n\":n,\"d-sh-t\":0});
							
let c = tm > 0 ? Math.max(Math.round(fd*1000/tm),1) : fd;
							timer.create(n,()=>timer_shake_common(temp.o1,pw,pw,cmd_set.randomness || 90,tm),c,true);
						}
						
return 1;