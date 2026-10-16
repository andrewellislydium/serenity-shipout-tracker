// Styles shared by the page and the downloaded HTML files.
// Copied from reference/tracker-reference.html (the CSS constant), with the spec changes noted inline.
export const CSS = `
:root{--P:#731F60;--V:#C6168D;--G:#FDB913;--B:#A36B37;--grey:#4D4D4A;--mid:#74736E;--line:#e3dfdc;--V20:#F0D3E6;--GBG:#EFEDEB;}
*{box-sizing:border-box;margin:0;padding:0}
html{scroll-behavior:smooth}
body{background:#f0eeec;padding:20px;font-family:'Source Sans 3','Source Sans Pro',Arial,sans-serif;font-size:13px;color:var(--grey)}
#app,.doc{max-width:1240px;margin:0 auto;background:#fff;box-shadow:0 1px 4px rgba(0,0,0,.08);padding-bottom:26px}
button,input,select,textarea{font-family:inherit;font-size:13px;color:inherit}
.hdr{background:var(--P);color:#fff;padding:18px 24px;display:flex;justify-content:space-between;align-items:flex-end;gap:20px;flex-wrap:wrap}
.hdr-eyebrow{font-size:11px;letter-spacing:.06em;text-transform:uppercase;color:var(--G);font-weight:600}
.hdr-title{font-size:24px;font-weight:700;margin-top:4px;line-height:1.15}
.hdr-sub{font-size:13px;color:#F0D3E6;margin-top:4px}
.hdr-r{display:flex;align-items:flex-end;gap:22px}
.ship-box label{display:block;font-size:10px;text-transform:uppercase;letter-spacing:.08em;color:#E4A9CF;font-weight:600;margin-bottom:3px}
.ship-box input{background:#fff;border:0;border-radius:3px;padding:4px 7px;color:var(--P);font-weight:600}
.ship-box .ship-fixed{font-size:15px;font-weight:700;color:#fff}
.ship-note{font-size:10px;color:#F0D3E6;margin-top:3px}
.hdr-meta{display:flex;flex-direction:column;align-items:flex-end;gap:8px}
.hdr-logo{width:124px;height:auto;display:block;background:#fff;padding:6px 8px;border-radius:2px;box-sizing:content-box}
.sync{font-size:10px;letter-spacing:.05em;text-transform:uppercase;color:#F0D3E6;font-weight:600}
.sync.ok{color:#fff}.sync.warn{color:var(--G)}
.sync-row{display:flex;align-items:center;gap:12px}
.signout{background:none;border:0;color:#F0D3E6;font-size:10px;letter-spacing:.05em;text-transform:uppercase;font-weight:600;cursor:pointer;padding:0;text-decoration:underline}
.signout:hover{color:#fff}
.ship-box input:disabled{opacity:1;color:var(--P);background:#F0D3E6}
.tabs{display:flex;align-items:center;gap:4px;padding:12px 24px 0;border-bottom:1.5px solid var(--P)}
.tab{background:#f7f5f3;border:1px solid var(--line);border-bottom:none;padding:8px 16px;cursor:pointer;font-weight:600;color:var(--mid);border-radius:3px 3px 0 0}
.tab.on{background:var(--P);color:#fff;border-color:var(--P)}
.tab-sp{flex:1}
.view{padding:16px 24px 0}
.vtools{display:flex;gap:10px;align-items:center;flex-wrap:wrap;margin-bottom:14px}
.btn{background:#fff;border:1.5px solid var(--P);color:var(--P);padding:6px 13px;border-radius:3px;cursor:pointer;font-weight:600}
.btn:hover{background:var(--V20)}
.btn.pri{background:var(--P);color:#fff}.btn.pri:hover{background:#5d194d}
.btn.ghost{border-color:#C0BDBA;color:var(--grey)}
.btn.danger{border-color:var(--B);color:#231F20;background:#fff}
.btn.sm{padding:3px 9px;font-size:12px}
input[type=text],input[type=date],select,textarea{border:1px solid #C0BDBA;border-radius:3px;padding:5px 7px;background:#fff}
textarea{width:100%;resize:vertical}
.chk{display:flex;align-items:center;gap:6px;font-size:12px}
:focus-visible{outline:2px solid var(--G);outline-offset:2px}
.sr{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0);white-space:nowrap}
.ro #btnAdd,.ro .edit-only{display:none!important}

/* KPIs */
.kpis{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:10px;margin-bottom:18px}
.kpi{border:1px solid var(--line);border-top:3px solid var(--P);padding:10px 12px;background:#faf9f7}
.kpi .n{font-size:26px;font-weight:700;color:var(--P);line-height:1.1}
.kpi .l{font-size:11px;text-transform:uppercase;letter-spacing:.06em;color:var(--mid);font-weight:600;margin-top:2px}
.kpi.warn{border-top-color:var(--B)}.kpi.warn .n{color:var(--B)}
.kpi.gold{border-top-color:var(--G)}
.sec-t{font-size:10px;font-weight:700;color:var(--V);text-transform:uppercase;letter-spacing:.1em;margin:18px 0 8px}
.stg{display:grid;grid-template-columns:230px 1fr 130px;gap:12px;align-items:center;padding:7px 0;border-top:1px solid var(--line)}
.stg:last-child{border-bottom:1px solid var(--line)}
.chip{display:inline-block;min-width:26px;text-align:center;padding:1px 7px;border-radius:9px;font-weight:700;font-size:11px}
.stg-n{font-weight:600;color:var(--P)}
.bar-prog{display:flex;height:12px;background:var(--GBG);border-radius:2px;overflow:hidden}
.bar-prog i{display:block;height:100%}
.stg-c{font-size:11px;color:var(--mid);text-align:right}

/* attention */
.att{list-style:none}
.att li{display:flex;gap:10px;padding:6px 0;border-top:1px solid var(--line);align-items:baseline}
.att li:last-child{border-bottom:1px solid var(--line)}
.att .tag{font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.05em;padding:1px 7px;border-radius:2px;white-space:nowrap}
.tag.over{background:var(--B);color:#231F20}.tag.blk{background:#231F20;color:#fff}.tag.due{background:var(--G);color:#231F20}.tag.ship{background:var(--V);color:#fff}.tag.ns{background:var(--V20);color:var(--P)}
.att a,.att button.lnk{background:none;border:0;cursor:pointer;color:var(--P);font-weight:600;text-align:left;padding:0}
.att .dt{color:var(--mid);font-size:12px;margin-left:auto;white-space:nowrap}
.empty{padding:18px;border:1px dashed #C0BDBA;color:var(--mid);text-align:center}

/* gantt */
.g-wrap{overflow-x:auto}
.g{position:relative;margin-top:4px;--lw:270px}
.g-head{display:flex;padding-left:var(--lw)}
.g-mo{flex:1;font-size:10px;font-weight:700;color:var(--P);text-transform:uppercase;letter-spacing:.05em;border-bottom:1.5px solid var(--P);padding:0 3px 3px;border-left:1px solid #C0BDBA;white-space:nowrap;overflow:hidden}
.g-days{display:flex;padding-left:var(--lw);margin-bottom:2px}
.g-d{flex:1;text-align:center;font-size:10px;color:var(--mid);padding:3px 0;line-height:1.25;min-width:0}
.g-d b{display:block;color:var(--grey)}
.g-d.we{background:#f4f2f0}.g-d.td b{color:var(--P)}.g-d.td{background:#FFF1C9}
.g-body{position:relative}
.g-over{position:absolute;left:var(--lw);right:0;top:0;bottom:0;pointer-events:none;z-index:0}
.g-over i{position:absolute;top:0;bottom:0}
.g-over .we{background:#f4f2f0}.g-over .td{background:rgba(253,185,19,.22);border-left:1px solid var(--G);border-right:1px solid var(--G)}
.g-over .shp{border-right:2px dashed var(--P)}
.g-grp{display:flex;align-items:center;gap:8px;padding:6px 0 5px;margin-top:6px;border-top:1.5px solid var(--P);position:relative;z-index:1;font-weight:700;color:var(--P)}
.g-grp small{font-weight:400;color:var(--mid)}
.g-row{display:flex;min-height:30px;border-top:1px solid #ece9e6;position:relative;z-index:1}
.g-lab{width:var(--lw);min-width:var(--lw);padding:4px 10px 4px 0;display:flex;flex-direction:column;justify-content:center;line-height:1.2}
.g-lab button{background:none;border:0;text-align:left;cursor:pointer;font-weight:600;color:var(--grey);padding:0}
.g-lab button:hover{text-decoration:underline}
.g-lab small{color:var(--mid);font-size:10.5px}
.g-track{flex:1;position:relative}
.g-bar{position:absolute;top:50%;height:20px;transform:translateY(-50%);border-radius:2px;font-size:10px;font-weight:700;letter-spacing:.03em;text-transform:uppercase;display:flex;align-items:center;justify-content:center;overflow:hidden;white-space:nowrap;border:1px solid transparent;cursor:pointer;padding:0}
.g-bar.done{background:var(--P);color:#fff;border-color:#4d1440}
.g-bar.doing{background:var(--V);color:#fff;border-color:#8f1064}
.g-bar.todo{background:var(--V20);color:var(--P);border-color:var(--V)}
.g-bar.blocked{background:var(--B);color:#231F20;border-color:#7d4f26}
.g-bar.late{box-shadow:0 0 0 2px var(--G)}
.g-ship-lab{position:absolute;top:-2px;transform:translateX(-50%);background:var(--P);color:var(--G);font-size:9px;font-weight:700;letter-spacing:.06em;padding:1px 5px;text-transform:uppercase;z-index:3;white-space:nowrap}
.leg{display:flex;gap:16px;flex-wrap:wrap;font-size:11px;color:var(--mid);margin-top:12px}
.leg span{display:flex;align-items:center;gap:6px}
.leg i{width:18px;height:9px;border-radius:2px;border:1px solid transparent;display:inline-block}

/* task table */
table.tt{width:100%;border-collapse:collapse}
.tt th{font-size:10px;text-transform:uppercase;letter-spacing:.07em;color:var(--P);text-align:left;padding:6px 8px;border-bottom:1.5px solid var(--P);white-space:nowrap}
.tt td{padding:7px 8px;border-bottom:1px solid var(--line);vertical-align:top}
.tt tr.grp td{background:#faf9f7;font-weight:700;color:var(--P);border-top:1.5px solid var(--P)}
.tt tr.isdone .ttl{text-decoration:line-through;color:var(--mid)}
.tt .ttl{font-weight:600;color:var(--grey)}
.tt .note{font-size:11.5px;color:var(--mid);margin-top:2px}
.tt .dts{white-space:nowrap}
.tt select{padding:3px 4px;font-size:12px}
.pill{display:inline-block;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.04em;padding:1px 7px;border-radius:2px}
.pill.todo{background:var(--V20);color:var(--P)}.pill.doing{background:var(--V);color:#fff}.pill.blocked{background:var(--B);color:#231F20}.pill.done{background:var(--P);color:#fff}

/* dialog */
dialog{border:0;border-radius:4px;padding:0;box-shadow:0 8px 40px rgba(0,0,0,.35);max-width:560px;width:calc(100% - 24px);font-family:'Source Sans 3','Source Sans Pro',Arial,sans-serif;color:var(--grey)}
dialog::backdrop{background:rgba(35,31,32,.5)}
.dlg-box{padding:18px 20px}
.dlg-title{font-size:18px;font-weight:700;color:var(--P);margin-bottom:12px;border-bottom:2px solid var(--G);padding-bottom:6px}
.fgrid{display:grid;grid-template-columns:1fr 1fr;gap:10px 14px}
.f{display:flex;flex-direction:column;gap:3px}.f span{font-size:10.5px;text-transform:uppercase;letter-spacing:.06em;color:var(--mid);font-weight:700}
.f input,.f select,.f textarea{width:100%}
.full{grid-column:1/-1}
.dlg-btns{display:flex;gap:8px;margin-top:14px;align-items:center}
.dlg-err{color:#8f1064;font-weight:600;min-height:16px;margin-top:8px;font-size:12px}

/* daily sheet */
.sheet{border:1px solid var(--line);padding:26px 30px;background:#fff;max-width:880px;margin:0 auto}
.sh-top{display:flex;justify-content:space-between;align-items:flex-end;gap:16px;border-bottom:3px solid var(--P);padding-bottom:10px}
.sh-eyebrow{font-size:10.5px;letter-spacing:.08em;text-transform:uppercase;color:var(--V);font-weight:700}
.sh-title{font-size:26px;font-weight:700;color:var(--P);line-height:1.1;margin-top:2px}
.sh-date{font-size:15px;color:var(--grey);margin-top:3px;font-weight:600}
.sh-ship{text-align:right}
.sh-ship .big{font-size:30px;font-weight:700;color:var(--P);line-height:1}
.sh-ship .sm{font-size:11px;text-transform:uppercase;letter-spacing:.06em;color:var(--mid);font-weight:600}
.sh-prog{display:grid;grid-template-columns:repeat(4,1fr);gap:8px;margin:12px 0 4px}
.sh-prog>div{border:1px solid var(--line);padding:6px 8px;font-size:11px;color:var(--mid)}
.sh-prog b{display:block;font-size:12px;color:var(--grey)}
.sh-prog .bp{margin-top:4px;height:6px}
.sh-h{font-size:10.5px;font-weight:700;color:var(--P);text-transform:uppercase;letter-spacing:.1em;margin:16px 0 6px;padding-bottom:3px;border-bottom:1.5px solid var(--P)}
table.gl{width:100%;border-collapse:collapse}
.gl td{padding:8px 6px;border-bottom:1px solid var(--line);vertical-align:top}
.gl td.cbc{width:40px}
.cb{display:inline-block;width:22px;height:22px;border:2px solid var(--P);border-radius:3px;position:relative;cursor:pointer;vertical-align:middle;background:#fff;-webkit-tap-highlight-color:transparent}
.cb::before{content:'';position:absolute;inset:-12px}
.cb.on{background:var(--P)}
.cb.on::after{content:'';position:absolute;left:6px;top:1px;width:6px;height:12px;border:solid #FDB913;border-width:0 3px 3px 0;transform:rotate(45deg)}
.gl .g-t{font-weight:600;color:#231F20;font-size:14px}
.gl .g-t.dn{text-decoration:line-through;color:var(--mid)}
.gl .g-n{font-size:11.5px;color:var(--mid);margin-top:2px}
.gl .g-m{font-size:11.5px;color:var(--mid);white-space:nowrap;text-align:right}
.gl .stc{display:inline-block;padding:0 6px;border-radius:8px;font-weight:700;font-size:10.5px;margin-right:6px}
.backup-m{display:none}
.hint{font-size:12px;color:var(--mid);margin:-4px 0 12px;text-align:center}
.sh-note{font-size:11.5px;color:var(--mid);text-align:center;margin:0 0 10px}
.sh-none{color:var(--mid);font-style:italic;padding:6px 0}
.notes-box{width:100%;min-height:112px;border:1px solid #C0BDBA;border-radius:3px;padding:9px 11px;font-size:14px;line-height:1.45;resize:vertical;font-family:inherit;background:#fff;color:#231F20}
.notes-box:focus{border-color:var(--P)}
.notes-text{white-space:pre-wrap;border-left:3px solid var(--G);padding:7px 11px;font-size:13.5px;color:#231F20;background:#faf9f7;line-height:1.5;margin-top:8px}
.notes-print{display:none}
.sh-lines{margin-top:8px}.sh-lines i{display:block;border-bottom:1px solid #b9b5b1;height:26px}
.sh-foot{display:flex;justify-content:space-between;align-items:center;margin-top:18px;padding-top:8px;border-top:1px solid #C0BDBA;font-size:10px;text-transform:uppercase;letter-spacing:.06em;color:var(--mid)}
.sh-foot .by{display:flex;align-items:center;gap:8px}
.sh-foot img{width:108px;height:auto;display:block}

@media screen and (max-width:760px){
  body{padding:6px}.view{padding:12px}.tabs{padding:10px 12px 0;flex-wrap:wrap}.hdr{padding:14px 14px}
  .stg{grid-template-columns:1fr}.stg-c{text-align:left}.g{--lw:150px}.fgrid{grid-template-columns:1fr}
  .hdr{padding:12px 14px}.hdr-title{font-size:19px;margin-top:2px}.hdr-sub,.ship-box,.hdr-logo{display:none}.hdr-r{width:100%;justify-content:flex-start}
  .tabs{gap:6px}.lg{display:none}.tabs .btn{display:none}
  .backup-m{display:flex;gap:8px;padding:18px 12px 0}.backup-m .btn{flex:1}
  .dtools #btnPrintDaily,.dtools .tab-sp{display:none}
  .dtools input[type=date]{flex:2 1 auto}
  .sh-prog{grid-template-columns:repeat(4,1fr);gap:6px}.sh-prog>div{padding:5px 6px;font-size:10.5px}.sh-prog b,.sh-prog .bp{display:none}
  .tab{flex:1 1 0;padding:11px 4px;text-align:center}.tab-sp{display:none}
  .sheet{border:0;padding:6px 2px}.sh-title{font-size:23px}.sh-ship .big{font-size:26px}
  table.gl,.gl tbody{display:block}
  .gl tr{display:grid;grid-template-columns:44px 1fr;align-items:start;border-bottom:1px solid var(--line);padding:9px 0}
  .gl td{border:0;padding:2px 4px}.gl td.cbc{width:auto;padding-top:3px}
  .gl td.g-m{grid-column:2;text-align:left;white-space:normal;padding-top:0}
  .gl .g-t{font-size:16px}.gl .g-n{font-size:12.5px}
  .cb{width:28px;height:28px}.cb.on::after{left:8px;top:1px;width:7px;height:15px}
  .sh-foot{flex-direction:column;align-items:flex-start;gap:8px}
  .vtools .btn{flex:1 1 auto}
}

/* printing */
@media print{
  body{background:#fff;padding:0}
  #app,.doc{box-shadow:none;max-width:none;padding:0}
  .noprint,.tabs,.btn{display:none!important}
  body.print-daily #hdr,body.print-daily #view-schedule,body.print-daily #view-tasks{display:none!important}
  body.print-daily #view-daily{display:block!important;padding:0}
  body.print-daily .sheet{border:0;padding:0;max-width:none}
  body.print-schedule #view-tasks,body.print-schedule #view-daily{display:none!important}
  body.print-schedule .view{padding:10px 0 0}
  body.print-schedule .hdr,.sheet-doc .sh-top{-webkit-print-color-adjust:exact;print-color-adjust:exact}
  *{-webkit-print-color-adjust:exact;print-color-adjust:exact}
  .cb{cursor:default}
  .notes-print{display:block}.notes-box{display:none!important}
  .g-wrap{overflow:visible}.g{min-width:0!important}
  .gl td{padding:5px 6px}.sh-lines i{height:22px}.sh-h{margin:12px 0 5px}.sh-prog{margin:10px 0 2px}.sheet{page-break-inside:auto}.sh-foot{break-inside:avoid}
}
`;
