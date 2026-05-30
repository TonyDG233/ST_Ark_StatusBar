case "zoom":

						temp.pos[0] = cmd_set.xscale || cmd_set.scale || temp.pos[0];
						temp.pos[3] = cmd_set.yscale || cmd_set.scale || temp.pos[3];
						temp.o1.css({\"transition\":\"transform \"+temp.fd+\"s linear\"});
						
break;