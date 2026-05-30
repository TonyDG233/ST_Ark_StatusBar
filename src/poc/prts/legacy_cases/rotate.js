case "rotate":

						temp.o2 = temp.o1.children();
						temp.o2.css(\"transform\",\"\");
						timer.clear(temp.n+\"_rotate\");
						if(cmd_set.stop == \"true\") 
return 1;
						temp.st = cmd_set.start == undefined ? 0 : cmd_set.start;
						temp.le = cmd_set.leftend == undefined ? -15 : -cmd_set.leftend;
						temp.re = cmd_set.rightend == undefined ? 15 : cmd_set.rightend;
						temp.o2.css({\"transform-origin\":\"center\",\"transition\":\"transform \"+temp.fd+\"s ease-in-out\",\"transform\":\"rotate(\"+temp.st+\"deg)\"});
						temp.o2.attr({\"data-r\":0,\"data-c\":0,\"data-cm\":temp.tm});
						timer.create(temp.n+\"_rotate\",()=>{
							
let d = temp.o2.attr(\"data-r\"),c = temp.o2.attr(\"data-c\"),t = temp.o2.attr(\"data-cm\");
							if(d == \"0\") temp.o2.css(\"transform\",\"rotate(\" + temp.le + \"deg)\");
							else temp.o2.css(\"transform\",\"rotate(\" + temp.re + \"deg)\");
							temp.o2.attr(\"data-r\",d == \"1\" ? \"0\" : \"1\");
							if(t == \"-1\") return;
							if(++c > t){
								temp.o2.css(\"transform\",\"\");
								timer.clear(temp.n+\"_rotate\");
							}
							temp.o2.attr(\"data-c\",c);
						},temp.fd*1000,true);
						
return 1;