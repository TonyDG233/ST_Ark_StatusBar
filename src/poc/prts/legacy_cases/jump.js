case "jump":

						for(
let i=0;i<temp.tm;i++)
						{
							setTimeout(() => {
								temp.o1.animate({\"top\":\"-=\"+temp.pw},temp.fd*500,(o = temp.o1)=>{
									o.animate({\"top\":0},temp.fd*500);
								});
							}, temp.fd*i*950);
						}
						temp.o1.css(\"transition\",\"transform \"+temp.fd+\"s\");
						
break;