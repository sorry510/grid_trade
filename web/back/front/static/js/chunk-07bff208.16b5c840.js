(window["webpackJsonp"]=window["webpackJsonp"]||[]).push([["chunk-07bff208"],{2465:function(e,t,n){"use strict";n.d(t,"a",(function(){return o})),n.d(t,"b",(function(){return a}));var r=n("b775");function o(){return Object(r["a"])({url:"/trades",method:"get"})}function a(e){return Object(r["a"])({url:"/trades",method:"put",data:e})}},d086:function(e,t,n){"use strict";n("ec37")},ec37:function(e,t,n){},f9f2:function(e,t,n){"use strict";n.r(t);var r=function(){var e=this,t=e.$createElement,n=e._self._c||t;return n("div",{staticClass:"app-container"},[n("div",{staticClass:"filter-container",staticStyle:{position:"relative",height:"40px"}},[n("el-button",{staticStyle:{position:"absolute",right:"0",top:"-5px"},attrs:{type:"primary"},on:{click:e.save}},[e._v("保存 ")])],1),n("codemirror",{ref:"cmEditor",staticStyle:{width:"100%"},attrs:{value:e.code,options:e.cmOptions},on:{ready:e.onCmReady,focus:e.onCmFocus,input:e.onCmCodeChange}})],1)},o=[],a=n("1da1"),c=(n("96cf"),n("2465")),i=n("8f94"),s=(n("a7be"),n("f9d4"),n("31c5"),n("9a48"),n("7b00"),n("7a7a"),n("8c2e"),n("9c7b"),n("715d"),n("23de"),n("18fe"),n("2aed"),n("d72f"),n("b933"),n("0b6c"),n("697e"),n("4895"),n("cbc8"),n("aedd"),n("164b"),{components:{codemirror:i["codemirror"]},data:function(){return{listLoading:!0,code:null,cmOptions:{tabSize:2,mode:{name:"javascript",json:!0},theme:"monokai",lineNumbers:!0,line:!0,foldGutter:!0,lineWrapping:!0,autoFormatJson:!0,jsonIndentation:!0,gutters:["CodeMirror-linenumbers","CodeMirror-foldgutter","CodeMirror-lint-markers"]}}},computed:{codemirror:function(){return this.$refs.cmEditor.codemirror}},created:function(){this.fetchData()},methods:{fetchData:function(){var e=this;return Object(a["a"])(regeneratorRuntime.mark((function t(){var n,r;return regeneratorRuntime.wrap((function(t){while(1)switch(t.prev=t.next){case 0:return e.listLoading=!0,t.next=3,Object(c["a"])();case 3:n=t.sent,r=n.data,e.code=JSON.stringify(r.list,null,2),e.listLoading=!1;case 7:case"end":return t.stop()}}),t)})))()},onCmReady:function(e){},onCmFocus:function(e){},onCmCodeChange:function(e){this.code=e},save:function(){var e=this;return Object(a["a"])(regeneratorRuntime.mark((function t(){return regeneratorRuntime.wrap((function(t){while(1)switch(t.prev=t.next){case 0:e.$confirm("此操作不可恢复，确认要保存吗？").then((function(){var t;try{t=JSON.parse(e.code)}catch(n){return void e.$message({message:"json格式不正确，请检查",type:"error"})}Object(a["a"])(regeneratorRuntime.mark((function n(){return regeneratorRuntime.wrap((function(n){while(1)switch(n.prev=n.next){case 0:return n.prev=0,n.next=3,Object(c["b"])({trades:t});case 3:e.$message({message:"修改成功",type:"success"}),n.next=9;break;case 6:n.prev=6,n.t0=n["catch"](0),e.$message({message:"网络错误，修改失败",type:"error"});case 9:case"end":return n.stop()}}),n,null,[[0,6]])})))()})).catch((function(){}));case 1:case"end":return t.stop()}}),t)})))()}}}),u=s,d=(n("d086"),n("2877")),f=Object(d["a"])(u,r,o,!1,null,null,null);t["default"]=f.exports}}]);