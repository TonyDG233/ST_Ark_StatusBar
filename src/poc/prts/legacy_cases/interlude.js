case "interlude":

				{
					
let ch = sets.channel;
					if(!ch) 
return -1;
					
let obj = document.querySelector(\"#inter_\"+ch);
					if(!obj){
						obj = document.createElement(\"span\");
						obj.className = \"interlude\";
						obj.id = \"inter_\" + ch;
						obj.style.position = \"absolute\";
					}
					
let mask = sets.maskid || \"\";
					
let [sx,sy] = sets.size ? sets.size.split(',') : [0,0];
					
let [px,py] = sets.offset ? sets.offset.split(',') : [0,0];
					sx *= mtpy;sy *= mtpy; px *= mtpy; py *= mtpy;
					if(sx > 0 && sy > 0){
						obj.style.width = `${sx}px`;
						obj.style.height = `${sy}px`;
						if(mask){
							obj.classList.add(mask);
							if(mask === \"ui_cutin_mask_horizon\") obj.style.marginTop = `${-sy/2}px`;
							else if(mask === \"ui_cutin_mask_vertical\") obj.style.marginLeft = `${-sx/2}px`;
						}
					}
				}
				
break;