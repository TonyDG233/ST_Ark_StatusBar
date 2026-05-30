case "timersticker":

				{
					
let px = cmd_set.x*0.75 || 0,py = cmd_set.y*0.75 || 0,size = cmd_set.size*0.75 || 18;
					
var span = document.getElementById(\"sticker_timer\");
					if(!span){
						span = document.createElement(\"span\");
						document.getElementById(\"sys_subtitle\").append(span);
					}
					span.className = \"subtitle_style\";
					
let id = \"sticker_timer\";
					span.id = id;
					span.style.fontSize = `${size}px`;
					span.style.left = `${px}px`;
					span.style.top = `${py}px`;
					span.setAttribute(\"max-t\",cmd_set.time || -1);
					span.setAttribute(\"now-t\",0);
					span.innerHTML = fun_format_time(0);
					timer.create(id,(n = id)=>{
						
var e = document.getElementById(n);
						if(!e){
							timer.clear(n,false);
							return;
						}
						
var t = parseInt(e.getAttribute(\"now-t\")) || 0,tm = parseInt(e.getAttribute(\"max-t\"));
						e.setAttribute(\"now-t\",++t);
						e.innerHTML = fun_format_time(t);
						if(tm<0 || t<tm) return;
						timer.clear(n,false);
					},1000,true);
				}
				
break;