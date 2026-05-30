case "vert_expand_buttom2top":

						cutin_paras.style = 6;
						temp.ts += temp.h;
						temp.iys -= temp.h;
						
break;

					default:
						cutin_paras.style = 0;
						
break;

				}
				cutin_paras.width = temp.w;
				cutin_paras.height = temp.h;
				cutin_paras.offsetx = temp.px;
				cutin_paras.left = temp.ls;
				cutin_paras.top = temp.ts;
				cutin_paras.imgX = temp.ixs;
				cutin_paras.imgY = temp.iys;
				data_cutin[temp.id] = cutin_paras;
				if(!chars[temp.n]) fun_msg(-1,false,\"<CharacterCutin>Data [\"+temp.n+\"] not exist,please check the data list.\");
				temp.o2.css({\"backgroundSize\":infos[0]+\"px \"+infos[1]+\"px\",\"backgroundImage\":\"url('\"+chars[temp.n]+\"')\",\"backgroundPosition\":temp.ixs+\"px \"+temp.iys+\"px\"});
				temp.o2.css({\"left\":temp.ls,\"top\":temp.ts});
				if(cutin_paras.style == 0) temp.o2.hide().css({\"width\":temp.w,\"height\":temp.h}).fadeIn(temp.t);
				else if(cutin_paras.style > 0 && cutin_paras.style <= 3) temp.o2.css({\"width\":0,\"height\":temp.h}).animate({\"width\":temp.w,\"left\":temp.le,\"backgroundPositionX\":temp.ixe},temp.t,\"linear\");
				else if(cutin_paras.style > 3 && cutin_paras.style <= 6) temp.o2.css({\"width\":temp.w,\"height\":0}).animate({\"height\":temp.h,\"top\":temp.te,\"backgroundPositionY\":temp.iye},temp.t,\"linear\");
				if(cmd_set.block == \"true\"){
					fun_delay(\"block\",temp.t,\"ms\");
					
return 2;
				}
				
break;