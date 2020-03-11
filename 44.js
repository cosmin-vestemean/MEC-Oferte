var zoomed = false, y = 0, q1 = 0, q1c = 0;

function ON_POST() {
	if ((SALDOC.UFTBL01 == 10) && (SALDOC.PAYMENT > 0)) {
		X.EXCEPTION('Atentie: Nu puteti avea metoda de plata CASH si termen scadent diferit de Livrare!');
	}

	verificLimitaCredit(SALDOC.TRDR, 2);

	cate = 0;
	ITELINES.FIRST;
	while (!ITELINES.Eof) {
		DsCateg = X.GETSQLDATASET('select mtracn as categ from mtrl where mtrl=' + ITELINES.MTRL, null);
		if ((calculStocDepozit(ITELINES.MTRL, MTRDOC.WHOUSE) > 0) && (ITELINES.WHOUSE != MTRDOC.WHOUSE) && (DsCateg.categ != 998)) {
			cate = cate + 1;

		}
		ITELINES.NEXT;
	}
	if (cate > 0) {
		X.EXCEPTION('Ati modificat depozitul pentru marfa disponibila in depozitul dumneavoastra!');
	}

	if (SALDOC.INT01 && !SALDOC.KEPYOHANDMD) {
		X.EXCEPTION('Ati ales sa convertiti oferta la aprobare\ndar nu ati indicat documentul in care se va converti.');
	}
	
	if (SALDOC.INT01 && SALDOC.KEPYOHANDMD) {
		X.WARNING('Oferta va fi convertita automat dupa aprobarea ofertei.');
	}
}

function ON_EDIT() {
	findocID();
	DsAprobat = X.GETSQLDATASET('select findoc from CCCAPROBOFERTA where findoc=' + vID, null);
	if (DsAprobat.RECORDCOUNT > 0)
		X.EXEC('button:Cancel');
}

function ON_SALDOC_FINSTATES() {
	CCCFINDOCAPP.APPEND;
	if (SALDOC.FINSTATES != 2001) {
		Ds = X.GETSQLDATASET('select isnull(finstates,0) as finstates from findoc where findoc=' + SALDOC.FINDOC, null);
		if (Ds.finstates > 0)
			CCCFINDOCAPP.FINSTATESOLD = Ds.finstates;
	}

	CCCFINDOCAPP.FINSTATENEW = SALDOC.FINSTATES;
	CCCFINDOCAPP.USERS = X.SYS.USER;
	Ds = X.GETSQLDATASET('select getdate() as data', null);
	CCCFINDOCAPP.USERTIME = Ds.data;

	/*calcDate = new Date(Ds.data);
	xHours = new String(calcDate.getHours());
	if (xHours<10){
	xHours = '0' + new String(xHours);
	}
	xMinutes = new String(calcDate.getMinutes());
	if (xMinutes<10){
	xMinutes = '0' + new String(xMinutes);
	}
	 */

	DsTime = X.GETSQLDATASET('SELECT cast(DATEPART(MONTH, GETDATE()) as varchar) as luna, cast(DATEPART(DAY, GETDATE()) as varchar) as zi, cast(DATEPART(HOUR, GETDATE()) as varchar) as ora, cast(DATEPART(minute, GETDATE()) as varchar) as minut', null);
	if (DsTime.ora < 10) {
		DsTime.ora = '0' + DsTime.ora;
	}
	if (DsTime.minut < 10) {
		DsTime.minut = '0' + DsTime.minut;
	}

	//CCCFINDOCAPP.CCCORA = xHours+':'+xMinutes;
	CCCFINDOCAPP.CCCORA = DsTime.ora + ':' + DsTime.minut;
}

function ON_SALDOC_TRDR() {
	SALDOC.CCCNAME = SALDOC.TRDR_CUSTOMER_NAME;
	DsDate = X.GETSQLDATASET('select isnull(utbl01,0) as utbl01, isnull(utbl02,0) as utbl02 from trdextra where company = ' + X.SYS.COMPANY + ' and sodtype=13 and trdr = ' + SALDOC.TRDR, null);
	if (DsDate.RECORDCOUNT > 0) {
		SALDOC.UFTBL01 = DsDate.utbl01;
		SALDOC.UFTBL02 = DsDate.utbl02;
	}
	if (SALDOC.FINDOC < 0) {
		SALDOC.SERIES = 7001;
		DsWhouse = X.GETSQLDATASET('select top 1 whouse from whouse where company = ' + X.SYS.COMPANY + ' and isnull(cccbranch,0) = ' + X.SYS.BRANCH + ' and isnull(isactive,0)=1', null);
		if (DsWhouse.whouse > 0)
			MTRDOC.WHOUSE = DsWhouse.whouse;
	}
	verificLimitaCredit(SALDOC.TRDR, 2);

	ITELINES.FIRST;
	while (!ITELINES.Eof) {
		if (ITELINES.QTY1 > 0) {
			cePret = citestePret(ITELINES.MTRL, SALDOC.TRDR, ITELINES.CCCQTY1);
			cePretPromo = citestePretPromo(ITELINES.MTRL);
			cePretFinal = Math.round(cePret * (1 - ITELINES.DISC1PRC / 100) * 100) / 100;
			//X.WARNING('Pret promo: ' + cePretPromo);
			//X.WARNING('Pret final: ' + cePretFinal);

			if ((cePretPromo == 0) || (cePretPromo > cePretFinal)) {
				ITELINES.PRICE = cePret;
				ITELINES.DISC1PRC = DsPret.discount;
				ITELINES.CCCPRET = Math.round(ITELINES.PRICE * (1 - ITELINES.DISC1PRC / 100) * 100) / 100;
			} else {
				ITELINES.PRICE = cePret;
				ITELINES.DISC1VAL = (cePret - cePretPromo) * ITELINES.QTY1;
				ITELINES.CCCPRET = cePretPromo;
			}
		}
		ITELINES.NEXT;
	}
}

function ON_SALDOC_TRDBRANCH() {
	DsAgent = X.GETSQLDATASET('select salesman from trdbranch where company = ' + X.SYS.COMPANY + ' and sodtype = 13 and trdbranch = ' + SALDOC.TRDBRANCH, null);
	if (DsAgent.salesman > 0)
		SALDOC.SALESMAN = DsAgent.salesman;
	else {
		DsAgent = X.GETSQLDATASET('select salesman from trdr where company = ' + X.SYS.COMPANY + ' and sodtype = 13 and trdr = ' + SALDOC.TRDR, null);
		if (DsAgent.salesman > 0)
			SALDOC.SALESMAN = DsAgent.salesman;
		else
			SALDOC.SALESMAN = null;
	}
}

function ON_SALDOC_ISPRINT() {
	if (SALDOC.ISPRINT == 1) {
		DsValabilitate = X.GETSQLDATASET('select getdate() as date1, DateAdd(d,7,getdate()) as date2', null);
		X.RunSql('update findoc set date01 = getdate(), date02 = DateAdd(d,7,getdate()) where company = ' + X.SYS.COMPANY + ' and sosource=1351 and findoc = ' + SALDOC.FINDOC, null);
		SALDOC.DATE01 = DsValabilitate.date1;
		SALDOC.DATE02 = DsValabilitate.date2;
	}
}

function ON_ITELINES_NEW() {
	if (SALDOC.CCCTRDRAUTO)
		ITELINES.CCCTRDRAUTO = SALDOC.CCCTRDRAUTO;
}

function ON_ITELINES_MTRL() {
	if (!SALDOC.TRDR)
		X.EXCEPTION('Atentie! Nu ati introdus CLIENTUL si nu se pot citi preturile!');
	//	if (!SALDOC.SHIPMENT)
	//		X.EXCEPTION('Atentie! Nu ati introdus METODA DE LIVRARE si nu se pot citi preturile!');

	DsCurr = X.GETSQLDATASET('select (select TOP 1 socurrency from ccclistapret where mtrl = ' + ITELINES.MTRL + ') as socurrency, code, name from mtrl where company = ' + X.SYS.COMPANY + ' and sodtype=51 and mtrl = ' + ITELINES.MTRL, null);
	//ITELINES.CCCSOCURRENCY = DsCurr.socurrency;
	ITELINES.CCCCOD = DsCurr.code;
	ITELINES.CCCNAME = DsCurr.name;

	ITELINES.CCCQTY1 = calculStocTotal(ITELINES.MTRL);
	ITELINES.CCCQTY1DEP = calculStocDepozit(ITELINES.MTRL, ITELINES.WHOUSE);
	calculTermenLivrare();
}

function ON_ITELINES_WHOUSE() {
	ITELINES.CCCQTY1 = calculStocTotal(ITELINES.MTRL);
	ITELINES.CCCQTY1DEP = calculStocDepozit(ITELINES.MTRL, ITELINES.WHOUSE);
	calculTermenLivrare();

}

function ON_ITELINES_WHOUSE_VALIDATE() {
	DsCateg = X.GETSQLDATASET('select mtracn as categ from mtrl where mtrl=' + ITELINES.MTRL, null);
	if ((calculStocDepozit(ITELINES.MTRL, MTRDOC.WHOUSE) > 0) && (ITELINES.WHOUSE != MTRDOC.WHOUSE) && (DsCateg.categ != 998)) {
		X.EXCEPTION('Nu puteti modifica depozitul!');

	}
}

function ON_ITELINES_PRICE() {
	calculPretFinal();
}

function ON_ITELINES_DISC1PRC() {
	calculPretFinal();
}

function ON_ITELINES_QTY1() {
	if (ITELINES.QTY1 > 0) {
		cePret = citestePret(ITELINES.MTRL, SALDOC.TRDR, ITELINES.CCCQTY1);
		cePretPromo = citestePretPromo(ITELINES.MTRL);
		cePretFinal = Math.round(cePret * (1 - ITELINES.DISC1PRC / 100) * 100) / 100;
		//X.WARNING('Pret promo: ' + cePretPromo);
		//X.WARNING('Pret final: ' + cePretFinal);

		if ((cePretPromo == 0) || (cePretPromo > cePretFinal)) {
			ITELINES.PRICE = cePret;
			ITELINES.DISC1PRC = DsPret.discount;
			ITELINES.CCCPRET = Math.round(ITELINES.PRICE * (1 - ITELINES.DISC1PRC / 100) * 100) / 100;
		} else {
			ITELINES.PRICE = cePret;
			ITELINES.DISC1VAL = (cePret - cePretPromo) * ITELINES.QTY1;
			ITELINES.CCCPRET = cePretPromo;
		}
	}
}

function ON_ITELINES_CCCTRDRAUTO() {
	if (ITELINES.CCCTRDRAUTO > 0) {
		DsAuto = X.GETSQLDATASET('select sasiu from ccctrdrauto where ccctrdrauto = ' + ITELINES.CCCTRDRAUTO, null);
		ITELINES.CCCSASIU = DsAuto.sasiu;
	}
}

function ON_ITELINES_POST() {
	calculPretFinal();
}

function ON_ITELINES_AFTERPOST() {
	verificaCoreCharge();
	verificaTaxaExo();
}

function ON_ITELINES_AFTERDELETE() {
	DsMtrl = X.GETSQLDATASET('select isnull(mtracn,0) as mtracn from mtrl where company = ' + X.SYS.COMPANY + ' and sodtype=51 and mtrl = ' + ITELINES.MTRL, null);
	if ((DsMtrl.mtracn == 998) || (DsMtrl.mtracn == 997))
		ITELINES.DELETE;
}

function ON_CCCSEARCHH_SEARCHTEXT() {
	if (!SALDOC.TRDR)
		X.EXCEPTION('Atentie! Nu ati introdus CLIENTUL si nu se pot citi preturile!');
	//	if (!SALDOC.SHIPMENT)
	//		X.EXCEPTION('Atentie! Nu ati introdus METODA DE LIVRARE si nu se pot citi preturile!');

	CCCSEARCHL.FIRST;
	while (!CCCSEARCHL.Eof) {
		CCCSEARCHL.DELETE;
	}

	CCCSEARCHLALT.FIRST;
	while (!CCCSEARCHLALT.Eof) {
		CCCSEARCHLALT.DELETE;
	}

	ceCaut = CCCSEARCHH.SEARCHTEXT;
	//X.WARNING(ceCaut.length);
	if (ceCaut.length < 4) {
		X.EXCEPTION('Cautarea se realizeaza dupa minim 4 caractere');
	}

	ceCaut = String.fromCharCode(39) + CCCSEARCHH.SEARCHTEXT + String.fromCharCode(39);

	//DsMtrl = X.GETSQLDATASET('select top 100 mtrl, code1 from mtrl where company = ' + X.SYS.COMPANY +
	//' and sodtype = 51 and (code like ' + ceCaut + ' or code1 like ' + ceCaut + ' or apvcode like ' + ceCaut + ' or cccuniversal like ' + ceCaut +
	//' or mtrl in (select mtrl from cccmtrloriginal where searchcode like ' + ceCaut + '))',null);


	DsMtrl = X.GETSQLDATASET('select top 100 mtrl, isnull(mtrmanfctr,0) as mtrmanfctr, ltrim(rtrim(code1)) as code1 from mtrl where company = ' + X.SYS.COMPANY +
			' and sodtype = 51 and isnull(isactive,0)=1 and (code = ' + ceCaut + ' or code1 = ' + ceCaut + ' or apvcode = ' + ceCaut + ' or cccuniversal = ' + ceCaut + ' or code2 = ' + ceCaut + ' ) ' +
			' union all ' +
			' select top 100 mtrl, isnull(mtrmanfctr,0) as mtrmanfctr, ltrim(rtrim(code1)) as code1 from mtrl where company = '
			 + X.SYS.COMPANY + ' and sodtype=51 and isnull(isactive,0)=1 and mtrl in (select mtrl from cccmtrloriginal where searchcode = ' + ceCaut + ')', null);

	ceCautAltRef = 0;
	DsAltRef = X.GETSQLDATASET('select count(*) as cate from mtrl where company = ' + X.SYS.COMPANY + ' and sodtype=51 and code1 = ' + ceCaut, null);
	if (DsAltRef.cate > 0)
		ceCautAltRef = 1;
	else
		ceCautAltRef = 0;

	DsMtrl.FIRST;
	while (!DsMtrl.Eof) {
		CCCSEARCHL.APPEND;
		CCCSEARCHL.MTRL = DsMtrl.mtrl;
		CCCSEARCHL.ALTREF = DsMtrl.code1;
		CCCSEARCHL.MTRMANFCTR = DsMtrl.mtrmanfctr;
		CCCSEARCHL.POST;

		/*		ceAltRef = DsMtrl.code1;
		if ((ceAltRef.length>0)&&(ceCautAltRef == 0)){
		DsAlternative = X.GETSQLDATASET('select mtrl, isnull(mtrmanfctr,0) as mtrmanfctr from mtrl where company = ' + X.SYS.COMPANY + ' and sodtype=51 and code1 = ' +
		String.fromCharCode(39) + DsMtrl.code1 + String.fromCharCode(39) + ' and mtrl<>' + DsMtrl.mtrl, null);
		DsAlternative.FIRST;
		while(!DsAlternative.Eof){
		CCCSEARCHLALT.APPEND;
		CCCSEARCHLALT.MTRL = DsMtrl.mtrl;
		CCCSEARCHLALT.MTRLALT = DsAlternative.mtrl;
		CCCSEARCHLALT.MTRMANFCTR = DsAlternative.mtrmanfctr;
		CCCSEARCHLALT.POST;
		DsAlternative.NEXT;
		}
		}
		 */
		DsMtrl.NEXT;
	}

	if (CCCSEARCHH.ALTERNATIVE == 1)
		afiseazaAlternative();
}

function ON_CCCSEARCHH_ALTERNATIVE() {
	if (CCCSEARCHH.ALTERNATIVE == 1)
		afiseazaAlternative();
}

function ON_CCCSEARCHH_SEARCHNAME() {
	if (!SALDOC.TRDR)
		X.EXCEPTION('Atentie! Nu ati introdus CLIENTUL si nu se pot citi preturile!');

	CCCSEARCHL.FIRST;
	while (!CCCSEARCHL.Eof) {
		CCCSEARCHL.DELETE;
	}

	ceCaut = String.fromCharCode(39) + '%' + CCCSEARCHH.SEARCHNAME + '%' + String.fromCharCode(39);
	DsMtrl = X.GETSQLDATASET('select top 100 mtrl from mtrl where company = ' + X.SYS.COMPANY +
			' and sodtype=51 and (name like ' + ceCaut + ' or name1 like ' + ceCaut + ' or ccclongdesc like ' + ceCaut + ')', null);
	DsMtrl.FIRST;
	while (!DsMtrl.Eof) {
		CCCSEARCHL.APPEND;
		CCCSEARCHL.MTRL = DsMtrl.mtrl;
		CCCSEARCHL.POST;
		DsMtrl.NEXT;
	}
}

function ON_CCCSEARCHL_MTRL() {
	CCCSEARCHL.STOCK = calculStocTotal(CCCSEARCHL.MTRL);
	CCCSEARCHL.STOCKDEP = calculStocDepozit(CCCSEARCHL.MTRL, MTRDOC.WHOUSE);
	cePret = citestePret(CCCSEARCHL.MTRL, SALDOC.TRDR, CCCSEARCHL.STOCK);
	cePretPromo = citestePretPromo(CCCSEARCHL.MTRL);
	CCCSEARCHL.PRICE = cePret;
	CCCSEARCHL.DISC1PRC = DsPret.discount;
	CCCSEARCHL.FINALPRICE = Math.round(CCCSEARCHL.PRICE * (1 - CCCSEARCHL.DISC1PRC / 100) * 100) / 100;
	CCCSEARCHL.PRICEPROMO = cePretPromo;
	CCCSEARCHL.SOCURRENCY = SALDOC.SOCURRENCY;
}

function ON_CCCSEARCHL_QTY1() {
	if ((!CCCSEARCHL.FINALPRICE) && (!CCCSEARCHL.PRICEPROMO)) {
		X.EXCEPTION('Atentie: Pretul produsului este 0. Nu-l puteti aduce in oferta!');
	}
	ITELINES.APPEND;
	ITELINES.MTRL = CCCSEARCHL.MTRL;
	ITELINES.QTY1 = CCCSEARCHL.QTY1;
	ITELINES.POST;
}

function ON_CCCSEARCHLALT_MTRLALT() {
	CCCSEARCHLALT.STOCK = calculStocTotal(CCCSEARCHLALT.MTRLALT);
	CCCSEARCHLALT.STOCKDEP = calculStocDepozit(CCCSEARCHLALT.MTRLALT, MTRDOC.WHOUSE);
	cePret = citestePret(CCCSEARCHLALT.MTRLALT, SALDOC.TRDR, CCCSEARCHLALT.STOCK);
	cePretPromo = citestePretPromo(CCCSEARCHLALT.MTRLALT);
	CCCSEARCHLALT.PRICE = cePret;
	CCCSEARCHLALT.DISC1PRC = DsPret.discount;
	CCCSEARCHLALT.FINALPRICE = Math.round(CCCSEARCHLALT.PRICE * (1 - CCCSEARCHLALT.DISC1PRC / 100) * 100) / 100;
	CCCSEARCHLALT.PRICEPROMO = cePretPromo;
	CCCSEARCHLALT.SOCURRENCY = SALDOC.SOCURRENCY;
}

function ON_CCCSEARCHLALT_QTY1() {
	if ((!CCCSEARCHLALT.FINALPRICE) && (!CCCSEARCHLALT.PRICEPROMO)) {
		X.EXCEPTION('Atentie: Pretul produsului este 0. Nu-l puteti aduce in oferta!');
	}
	ITELINES.APPEND;
	ITELINES.MTRL = CCCSEARCHLALT.MTRLALT;
	ITELINES.QTY1 = CCCSEARCHLALT.QTY1;
	ITELINES.POST;
}

function ON_CCCFINDOCAPP_REMARKS() {
	if (CCCFINDOCAPP.USERS != X.SYS.USER) {
		X.EXCEPTION('Nu puteti modifica detalii introduse de un alt utilizator.');
	}
}

function ON_SFMTRSUB_SHOW() {
	CCCHISTALT.SERIES = '7204,7205,7206,7207,7208,7209,7210,7211,7212,7213,7214,7215,7253,7254,7255,7256,7257,7258,7259,7260,7261,7262,7263,7264,7440,7450,7452,7453,7454,7455,7456,7457,7458,7459,7460,7461,7462,7463,7464,7510,7511,7512,7513,7514,7515,7516,7517,7518,7519,7520,7521';
	CCCHISTALT.CODE_ITEM_CODE = ITELINES.MTRL_ITEM_CODE;
	CCCHISTALT.CODE_ITEM_NAME = ITELINES.MTRL_ITEM_NAME;
	CCCHISTALT.TRDR = SALDOC.TRDR_CUSTOMER_NAME;

	afiseazaIstoric();

}
/*
function ON_SFMTRSUB_SHOW(){
lcString = 'SELECT A.MTRL AS MTRL,A.MTRLSUB AS MTRLSUB,A.CODE AS CODE,A.NAME AS NAME,'+
'(SELECT SUM(ISNULL(IMPQTY1,0))-SUM(ISNULL(EXPQTY1,0)) FROM MTRBALSHEET WHERE COMPANY='+X.SYS.COMPANY+' AND WHOUSE='+ITELINES.WHOUSE+' AND MTRL=A.MTRLSUB AND FISCPRD='+X.SYS.FISCPRD+') AS STOCW,'+
'(SELECT SUM(ISNULL(IMPQTY1,0))-SUM(ISNULL(EXPQTY1,0)) FROM MTRBALSHEET WHERE COMPANY='+X.SYS.COMPANY+' AND MTRL=A.MTRLSUB AND FISCPRD='+X.SYS.FISCPRD+') AS STOCC'+
' FROM MTRSUBSTITUTE A LEFT OUTER JOIN MTRL B ON A.MTRLSUB=B.MTRL'+
' WHERE A.MTRL='+ITELINES.MTRL+' AND A.MTRLSUB IS NOT NULL';
DsAlternative = X.GETSQLDATASET(lcString,null);

CCCALTERNATIVE.FIRST;
while(!CCCALTERNATIVE.Eof){
CCCALTERNATIVE.DELETE;
}

DsAlternative.FIRST;
while(!DsAlternative.Eof){
CCCALTERNATIVE.APPEND;
CCCALTERNATIVE.CODE = DsAlternative.code;
CCCALTERNATIVE.NAME = DsAlternative.name;
CCCALTERNATIVE.MTRL = DsAlternative.mtrlsub;
CCCALTERNATIVE.STOCC = DsAlternative.stocc;
CCCALTERNATIVE.STOCW = DsAlternative.stocw;
CCCALTERNATIVE.POST;

DsAlternative.NEXT;
}
}

function ON_SFMTRSUB_ACCEPT(){
ITELINES.MTRL = CCCALTERNATIVE.MTRL;
}
 */

function ON_SFITELINES_SHOW() {
	lcString = ' select whouse, isnull(sum(stock),0) as stock, isnull(sum(qty1),0) as qty1 from ' +
		'(select whouse, sum(isnull(impqty1,0) - isnull(expqty1,0)) as stock, 0 AS QTY1 from mtrbalsheet where company = ' +
		X.SYS.COMPANY + ' and fiscprd = ' + X.SYS.FISCPRD + ' and mtrl = ' + ITELINES.MTRL + ' GROUP BY WHOUSE ' +
		'UNION ALL ' +
		'SELECT WHOUSE, 0, (SUM(AA.QTY1)-SUM(AA.QTY1COV)) AS QTY1 ' +
		' FROM MTRLINES AA LEFT JOIN FINDOC BB ON AA.FINDOC=BB.FINDOC LEFT OUTER JOIN TRDR CC ON BB.TRDR = CC.TRDR LEFT JOIN RESTMODE RM ON AA.RESTMODE=RM.RESTMODE AND AA.COMPANY=RM.COMPANY ' +
		' WHERE AA.COMPANY = ' + SALDOC.COMPANY + ' AND AA.PENDING  = 1 AND AA.COMPANY  = BB.COMPANY AND AA.SOSOURCE = BB.SOSOURCE ' +
		' AND AA.FINDOC = BB.FINDOC AND AA.QTY1<>0 AND RM.RESTCATEG = 2 AND AA.MTRL=' + ITELINES.MTRL + ' GROUP BY AA.WHOUSE) ABC group by whouse order by whouse';
	DsRezervari = X.GETSQLDATASET(lcString, null);

	CCCREZERVARI.FIRST;
	while (!CCCREZERVARI.Eof) {
		CCCREZERVARI.DELETE;
	}

	DsRezervari.FIRST;
	while (!DsRezervari.Eof) {
		if (DsRezervari.WHOUSE != 9999) {
			CCCREZERVARI.APPEND;
			CCCREZERVARI.WHOUSE = DsRezervari.whouse;
			CCCREZERVARI.QTY1 = DsRezervari.stock;
			CCCREZERVARI.QTY1COM = DsRezervari.qty1;
			CCCREZERVARI.QTY1REST = CCCREZERVARI.QTY1 - CCCREZERVARI.QTY1COM;
			CCCREZERVARI.POST;
		}
		DsRezervari.NEXT;
	}
}

function ON_SFITELINES_ACCEPT() {
	vOk = 0;
	CCCREZERVARI.FIRST;
	while (!CCCREZERVARI.Eof) {
		if (CCCREZERVARI.QTY1LINIE > 0) {
			vOk = vOk + 1;
			if (vOk == 1) {
				ITELINES.WHOUSE = CCCREZERVARI.WHOUSE;
				ITELINES.QTY1 = CCCREZERVARI.QTY1LINIE;
			} else {
				ceMtrl = ITELINES.MTRL;
				ceWhouse = CCCREZERVARI.WHOUSE;
				ceQty = CCCREZERVARI.QTY1LINIE;
				ITELINES.APPEND;
				ITELINES.MTRL = ceMtrl;
				ITELINES.WHOUSE = ceWhouse;
				ITELINES.QTY1 = ceQty;
				ITELINES.POST;
			}
		}
		CCCREZERVARI.NEXT;
	}
}

function EXECCOMMAND(cmd) {
	if (cmd == '20171031') {
		refreshDisponibilitateStoc();
	}
	if (cmd == '201710311') {
		conversieComanda();
	}
	if (cmd == '201801221') {
		conversieDL(7151);
	}
	if (cmd == '201801222') {
		conversieDL(7152);
	}
	if (cmd == '20171102') {
		X.OPENSUBFORM('SFSEARCH');
	}
	if (cmd == '20171107') {
		aCommand = "XCMD:ITEM[FORM=S1 - Pictograma,AUTOLOCATE=" + CCCSEARCHL.MTRL + "]";
		X.EXEC(aCommand);
	}
	if (cmd == '20171108') {
		arataImagini(CCCSEARCHL.MTRL);
	}
	if (cmd == '201711071') {
		aCommand = "XCMD:ITEM[FORM=S1 - Pictograma,AUTOLOCATE=" + CCCSEARCHLALT.MTRLALT + "]";
		X.EXEC(aCommand);
	}
	if (cmd == '201711081') {
		arataImagini(CCCSEARCHLALT.MTRLALT);
	}
	if (cmd == '20181017') {
		afiseazaIstoric();
	}

	if (cmd == '201909241') {
		if (zoomed) {
			X.SETPROPERTY('PANEL', 'N_289265184', 'VISIBLE', 'TRUE');
			X.SETPROPERTY('PANEL', 'Panel13', 'VISIBLE', 'FALSE');
			X.SETPROPERTY('PANEL', 'Panel13', 'VISIBLE', 'TRUE');
			X.SETPROPERTY('PANEL', 'N_406190376', 'VISIBLE', 'TRUE');
		} else {
			X.SETPROPERTY('PANEL', 'N_406190376', 'VISIBLE', 'FALSE');
			X.SETPROPERTY('PANEL', 'N_289265184', 'VISIBLE', 'FALSE');
		}

		zoomed = !zoomed;
	}

	if (cmd == '20200205') {
		//debugger;
		if (y && getFullyTr() == 0 && q1c == 0) {
			backgroundConv();
			X.SETPROPERTY('MERGECHANGELOG', 1);
		} else {
			X.WARNING('Are nevoie de aprobare\nsau\na fost convertita anterior.');
		}
	}

}

function backgroundConv() {
	//X.WARNING(backgroundConv.caller);
	var fprms;

	//debugger;

	if (SALDOC.KEPYOHANDMD == 1) {
		fprms = 7051;
	} else if (SALDOC.KEPYOHANDMD == 2) {
		fprms = 7151;
	} else if (SALDOC.KEPYOHANDMD == 3) {
		fprms = 7152;
	} else {
		X.WARNING('Alegeti documentul in care urmeaza sa fie convertita oferta.');
		return;
	}

	var unika = [];
	ITELINES.DISABLECONTROLS;
	ITELINES.FIRST;
	while (!ITELINES.EOF) {
		var foundIt = false;
		for (var i = 0; i < unika.length; i++) {
			if (unika[i] == ITELINES.WHOUSE) {
				foundIt = true;
				break;
			}
		}
		if (!foundIt) {
			unika.push(ITELINES.WHOUSE);
		}
		ITELINES.NEXT;
	}

	ITELINES.ENABLECONTROLS;

	var convSuccesfully = [],
	convUnsucc = [];

	for (var j = 0; j < unika.length; j++) {

		//filtreaza succesiv dupa fiecare unikainct whouse din linii si creaza doc cu serie, branch si whouse corespunzator
		ITELINES.FILTER = '({ITELINES.WHOUSE}=' + unika[j] + ')';
		ITELINES.FILTERED = 1;

		var doc = X.CreateObj('SALDOC'),
		pre = X.CreateObj('SALDOC');

		try {
			doc.DBInsert;
			pre.DBInsert;
			var h = doc.FindTable('FINDOC'),
			hp = pre.FindTable('FINDOC'),
			md = doc.FindTable('MTRDOC'),
			mdp = pre.FindTable('MTRDOC');
			h.Edit;
			hp.Edit;
			ITELINES.FIRST;

			h.FPRMS = fprms;
			hp.FPRMS = h.FPRMS;
			var b = X.GETSQLDATASET('select cccbranch BRANCH from whouse where company = :X.SYS.COMPANY and whouse=' + ITELINES.WHOUSE, null).BRANCH;
			if (!b) {
				X.WARNING('No branch for this ' + ITELINES.WHOUSE + ' whouse.');
				return;
			}
			var ser = X.GETSQLDATASET('select SERIES from series where series < 8000 and company=:X.SYS.COMPANY and sosource=1351 and fprms=' + fprms + ' and branch=' +
					b, null).SERIES;
			if (ser)
				h.SERIES = ser;
			var serp = X.GETSQLDATASET('select SERIES from series where company=:X.SYS.COMPANY and sosource=1351 and fprms=7050 and branch=' +
					b, null).SERIES;
			if (serp)
				hp.SERIES = serp;
			if (ITELINES.WHOUSE)
				md.WHOUSE = ITELINES.WHOUSE;
			if (md.WHOUSE)
				mdp.WHOUSE = md.WHOUSE;
			if (SALDOC.SOCARRIER)
				md.SOCARRIER = SALDOC.SOCARRIER;
			if (md.SOCARRIER)
				mdp.SOCARRIER = md.SOCARRIER;
			if (SALDOC.TRDR)
				h.TRDR = SALDOC.TRDR;
			if (h.TRDR)
				hp.TRDR = h.TRDR;
			if (SALDOC.TRDBRANCH)
				h.TRDBRANCH = SALDOC.TRDBRANCH;
			if (h.TRDBRANCH)
				hp.TRDBRANCH = h.TRDBRANCH;
			if (SALDOC.SALESMAN)
				h.SALESMAN = SALDOC.SALESMAN;
			if (h.SALESMAN)
				hp.SALESMAN = h.SALESMAN;
			if (SALDOC.UFTBL01)
				h.UFTBL01 = SALDOC.UFTBL01;
			if (h.UFTBL01)
				hp.UFTBL01 = h.UFTBL01;
			if (SALDOC.UFTBL02)
				h.UFTBL02 = SALDOC.UFTBL02;
			if (h.UFTBL02)
				hp.UFTBL02 = h.UFTBL02;
			if (SALDOC.PAYMENT)
				h.PAYMENT = SALDOC.PAYMENT;
			if (h.PAYMENT)
				hp.PAYMENT = h.PAYMENT;
			if (SALDOC.SHIPMENT)
				h.SHIPMENT = SALDOC.SHIPMENT;
			if (h.SHIPMENT)
				hp.SHIPMENT = h.SHIPMENT;
			if (SALDOC.CCCTRDRAUTO)
				h.CCCTRDRAUTO = SALDOC.CCCTRDRAUTO;
			if (h.CCCTRDRAUTO)
				hp.CCCTRDRAUTO = h.CCCTRDRAUTO;
			if (SALDOC.CCCNUM01)
				h.CCCNUM01 = SALDOC.CCCNUM01;
			if (h.CCCNUM01)
				hp.CCCNUM01 = h.CCCNUM01;
			if (SALDOC.COMMENTS)
				h.COMMENTS = SALDOC.COMMENTS;
			if (h.COMMENTS)
				hp.COMMENTS = h.COMMENTS;

			var l = doc.FindTable('ITELINES'),
			lp = pre.FindTable('ITELINES');
			l.Edit;
			lp.Edit;
			while (!ITELINES.EOF) {
				if (ITELINES.MTRL_ITEM_MTRACN != 999 &&
					ITELINES.MTRL_ITEM_MTRACN != 998 &&
					ITELINES.MTRL_ITEM_MTRACN != 997) {

					//actualizeaza stocul per depozit
					var zz = calculStocDepozit(ITELINES.MTRL, ITELINES.WHOUSE);
					addCurrentLineToTbls(l, lp, zz);
				}

				ITELINES.NEXT;
			}

			var id,
			idp;

			if (l.RECORDCOUNT) {
				id = doc.DBPost;
				recordProgress(id, convSuccesfully, convUnsucc);
			}

			if (lp.RECORDCOUNT) {
				idp = pre.DBPost;
				recordProgress(idp, convSuccesfully, convUnsucc);
			}
		} catch (err) {
			X.WARNING(err.message);
		}
		finally {
			doc.FREE;
			pre.FREE;
			doc = null;
			pre = null;
		}

		ITELINES.FILTERED = 0;
	}

	//debugger;

	var msgOk = '',
	msgOKHTML = '',
	msgBleah = '',
	msgBleahHTML,
	msg = '',
	body = '';
	if (convSuccesfully.length) {
		for (var b = 0; b < convSuccesfully.length; b++) {
			msgOKHTML += '<tr><td>' + convSuccesfully[b].fincode + '</td><td>' + convSuccesfully[b].whName + '</td></tr>';
			msgOk += convSuccesfully[b].fincode + ' pe depozitul ' + convSuccesfully[b].whName + '\n';
		}
	}

	if (convUnsucc.length) {
		for (var c = 0; c < convUnsucc.length; c++) {
			msgBleahHTML += convUnsucc[c].whName + '</br>';
			msgBleah += convUnsucc[c].whName + '\n';
		}
	}
	if (msgOKHTML) {
		msgOKHTML = '<h2>Oferta ' + SALDOC.FINCODE + ' / ' + SALDOC.TRDR_CUSTOMER_NAME +
			' a fost <i>aprobata si convertita</i> in:</h2>' + ' <table>' + msgOKHTML + '</table>' +
			'<br><p>Acest email a fost generat automat.</p><p>Cu stima,<br>' + X.SQL('select name from users where users=' + X.SYS.USER, null);
		msgOk = 'Oferta ' + SALDOC.FINCODE + ' / ' + SALDOC.TRDR_CUSTOMER_NAME + ' a fost aprobata si convertita in\n' + msgOk;
	}

	if (msgBleahHTML) {
		msgBleahHTML = '<p>Pentru urmatoarele depozite <b>NU</b> au fost generate documente:</p>' + msgBleahHTML;
		msgBleah = '\nPentru urmatoarele depozite NU au fost generate documente:\n' + msgBleah;
	}

	if (msgBleahHTML) {
		body = msgOKHTML + msgBleahHTML;
		msg = msgOk + msgBleah;
	} else {
		body = msgOKHTML;
		msg = msgOk;
	}

	if (msg) {
		X.WARNING(msg);
	}

	if (convSuccesfully.length == unika.length) {
		updateFullyTr(1);
	} else if (convSuccesfully.length != 0 && convSuccesfully.length < unika.length) {
		updateFullyTr(2);
	} else if (convSuccesfully.length == 0) {
		updateFullyTr(0);
	}

	//trimite email;

	var subj = 'Oferta ' + SALDOC.FINCODE + ' / ' + SALDOC.TRDR_CUSTOMER_NAME + ' a fost aprobata si convertita';

	if (convSuccesfully.length && sendMail('marian.ghidovet@mecdiesel.ro', 'cosmin.ve@gmail.com', subj, body)) {
		//good
	} else {
		//bad

	}
	X.SETPROPERTY('MERGECHANGELOG', 1);
}

function sendMail(to, cc, subj, body) {
	var theApp,
	theMailItem;

	try {
		var theApp = new ActiveXObject('Outlook.Application');
		var theMailItem = theApp.CreateItem(0);
		theMailItem.to = to;
		theMailItem.cc = cc;
		theMailItem.Subject = subj;
		//theMailItem.Body = body;
		theMailItem.HTMLBody = body;
		//theMailItem.Attachments.Add(cale_fisier);
		//theMailItem.display();
		X.PROCESSMESSAGES;
		theMailItem.send();
		X.PROCESSMESSAGES;
		return 1;
	} catch (err) {
		X.WARNING('The following may have cause this error: ' + err.message);
		return 0;
	}
}

function recordProgress(id, convSuccesfully, convUnsucc) {
	var whN = X.SQL('select name from whouse where company=' + X.SYS.COMPANY + ' and whouse=' + ITELINES.WHOUSE, null);
	if (id) {
		var temp = {};
		temp.id = id;
		temp.whouse = ITELINES.WHOUSE;
		temp.whName = whN;
		temp.fincode = X.SQL('SELECT FINCODE FROM FINDOC WHERE FINDOC=' + id, null);
		convSuccesfully.push(temp);
	} else {
		var tempp = {};
		tempp.whouse = ITELINES.WHOUSE;
		tempp.whName = whN;
		convUnsucc.push(tempp);
	}
}

function areTaxe(l, lp) {
	//daca mtrl are taxa eco sau core (ITEEXTRA.NUM01 sau ITEM.RELITEM), localizeaza-l si split it toolbar
	var eco = X.SQL('select isnull(num01, 0) exo from mtrextra where mtrl=' + ITELINES.MTRL, null),
	core = X.SQL('select isnull(relitem, 0) core from mtrl where mtrl=' + ITELINES.MTRL, null);
	if (eco) {
		addTaxa(eco);
	}

	if (core) {
		addTaxa(core);
	}
}

function addTaxa(taxa) {
	var zz = calculStocDepozit(ITELINES.MTRL, ITELINES.WHOUSE),
	wh = ITELINES.WHOUSE;
	if (ITELINES.LOCATE('MTRL;WHOUSE', eco, wh) == 1) {
		addCurrentLineToTbls(l, lp, zz);
	}
}

function addCurrentLineToTbls(l, lp, zz) {
	//debugger;
	if (zz) {
		addFirst(l);

		if (ITELINES.QTY1) {
			if (ITELINES.QTY1 > zz) {
				//cat e disponibil ajunge pe doc principal, restul pe precomanda
				l.QTY1 = zz;

				addFirst(lp);

				lp.QTY1 = ITELINES.QTY1 - zz;

				addTheRest(lp);

				lp.POST;
			} else {
				l.QTY1 = ITELINES.QTY1;
			}
		}

		addTheRest(l);

		l.POST;
	} else {
		//doar precomanda
		//12948
		addFirst(lp);

		lp.QTY1 = ITELINES.QTY1;

		addTheRest(lp);

		lp.POST;
	}
}

function addFirst(tbl) {
	tbl.APPEND;
	if (ITELINES.MTRL)
		tbl.MTRL = ITELINES.MTRL;
	if (ITELINES.WHOUSE)
		tbl.WHOUSE = ITELINES.WHOUSE;
}

function addTheRest(tbl) {
	if (ITELINES.PRICE)
		tbl.PRICE = ITELINES.PRICE;
	if (ITELINES.DISC1PRC)
		tbl.DISC1PRC = ITELINES.DISC1PRC;
	if (ITELINES.DISC2PRC)
		tbl.DISC2PRC = ITELINES.DISC2PRC;
	if (ITELINES.CCCPRET)
		tbl.CCCPRET = ITELINES.CCCPRET;
	if (ITELINES.FINDOC)
		tbl.FINDOCS = ITELINES.FINDOC;
	if (ITELINES.MTRLINES)
		tbl.MTRLINESS = ITELINES.MTRLINES;
	if (ITELINES.CCCCOD)
		tbl.CCCCOD = ITELINES.CCCCOD;
	if (ITELINES.CCCNAME)
		tbl.CCCNAME = ITELINES.CCCNAME;
	if (ITELINES.CCCTRDRAUTO)
		tbl.CCCTRDRAUTO = ITELINES.CCCTRDRAUTO;
	if (ITELINES.CCCSASIU)
		tbl.CCCSASIU = ITELINES.CCCSASIU;
}

function updateFullyTr(n) {
	X.RunSQL('update findoc set fullytransf = ' + n + ' where findoc=' + SALDOC.FINDOC, null);
}

function refreshDisponibilitateStoc() {
	ITELINES.FIRST;
	while (!ITELINES.EOF) {
		ITELINES.CCCQTY1 = calculStocTotal(ITELINES.MTRL);
		ITELINES.CCCQTY1DEP = calculStocDepozit(ITELINES.MTRL, ITELINES.WHOUSE);
		ITELINES.BOOL01 = 1;
		ITELINES.NEXT;
	}
}

function prelucrareServiciiAutomate() {
	ITELINES.FIRST;
	while (!ITELINES.Eof) {
		DsMtrl = X.GETSQLDATASET('select isnull(mtracn,0) as mtracn from mtrl where company = ' + X.SYS.COMPANY + ' and sodtype=51 and mtrl = ' + ITELINES.MTRL, null);
		if ((DsMtrl.mtracn == 998) || ((DsMtrl.mtracn == 997))) {
			ITELINES.PRIOR;
			ceStockAutomat = calculStocDepozit(ITELINES.MTRL, ITELINES.WHOUSE);
			ITELINES.NEXT;
			if (ceStockAutomat > 0) {
				lcString = 'update mtrlines set cccqty1dep = ' + ceStockAutomat + ' where findoc = ' + SALDOC.FINDOC + ' and mtrlines = ' + ITELINES.MTRLINES;
				X.RunSQL(lcString, null);
			}
		}
		ITELINES.NEXT;
	}
}

function conversieComanda() {
	if (SALDOC.FINDOC < 0) {
		X.EXCEPTION('Atentie: Documentul nu este salvat. Nu puteti genera o comanda fara sa fie documentul salvat!');
	}

	verificLimitaCredit(SALDOC.TRDR, 1);

	DsTrdr = X.GETSQLDATASET('select isnull(salesman,0) as salesman, ' +
			'(select count(*) from trdbankacc where trdr=trdr.trdr) as nobank, ' +
			'(select isnull(utbl01,0) as utbl01 from trdextra where company = ' + X.SYS.COMPANY + ' and sodtype=13 and trdr=trdr.trdr) as utbl01, ' +
			'(select isnull(utbl02,0) as utbl02 from trdextra where company = ' + X.SYS.COMPANY + ' and sodtype=13 and trdr=trdr.trdr) as utbl02, ' +
			'isnull(payment,0) as payment from trdr where company = ' + X.SYS.COMPANY + ' and sodtype = 13 and trdr = ' + SALDOC.TRDR, null);
	if (DsTrdr.salesman == 0) {
		X.EXCEPTION('Atentie: Agentul de vanzari nu este completat la nivelul clientului. Comanda nu poate fi finalizata!');
	}
	//	if (DsTrdr.nobank == 0)
	//	{
	//		X.EXCEPTION('Atentie: Contul bancar nu este completat la nivelul clientului. Comanda nu poate fi finalizata!');
	//	}
	if (DsTrdr.utbl01 == 0) {
		X.EXCEPTION('Atentie: Metoda de plata nu este completata la nivelul clientului. Comanda nu poate fi finalizata!');
	}
	//	if (DsTrdr.utbl02 == 0)
	//	{
	//		X.EXCEPTION('Atentie: Periodicitatea instrumentului de plata nu este completata la nivelul clientului. Comanda nu poate fi finalizata!');
	//	}
	if (DsTrdr.payment == null) {
		X.EXCEPTION('Atentie: Termenul de plata nu este completat la nivelul clientului. Comanda nu poate fi finalizata!');
	}

	if ((!MTRDOC.SOCARRIER) || (MTRDOC.SOCARRIER == 0) || (MTRDOC.SOCARRIER == null)) {
		X.EXCEPTION('Atentie: Nu ati completat mod transport in oferta!..');
	}
	prelucrareServiciiAutomate();

	aCommand = 'XCMD:ClientImport,ScriptName:MecOfertaComanda,myFindoc:' + SALDOC.FINDOC;
	X.EXEC(aCommand);

	/*DsFindoc = X.GETSQLDATASET('select max(findoc) as findoc from mtrlines where findocs = ' + SALDOC.FINDOC,null);
	NEWSALDOCID = DsFindoc.findoc;
	if (NEWSALDOCID>0){
	aCommand = "XCMD:SALDOC[FORM=S1 - Comenzi clienti,AUTOLOCATE="+NEWSALDOCID+"]";
	X.EXEC(aCommand);
	}*/
}

function conversieDL(ceFprms) {
	if (SALDOC.FINDOC < 0) {
		X.EXCEPTION('Atentie: Documentul nu este salvat. Nu puteti genera o Dispozitie de livrare fara sa fie documentul salvat!');
	}

	verificLimitaCredit(SALDOC.TRDR, 1);

	DsTrdr = X.GETSQLDATASET('select isnull(salesman,0) as salesman, ' +
			'(select count(*) from trdbankacc where trdr=trdr.trdr) as nobank, ' +
			'(select isnull(utbl01,0) as utbl01 from trdextra where company = ' + X.SYS.COMPANY + ' and sodtype=13 and trdr=trdr.trdr) as utbl01, ' +
			'(select isnull(utbl02,0) as utbl02 from trdextra where company = ' + X.SYS.COMPANY + ' and sodtype=13 and trdr=trdr.trdr) as utbl02, ' +
			'isnull(payment,0) as payment from trdr where company = ' + X.SYS.COMPANY + ' and sodtype = 13 and trdr = ' + SALDOC.TRDR, null);
	if (DsTrdr.salesman == 0) {
		X.EXCEPTION('Atentie: Agentul de vanzari nu este completat la nivelul clientului. Dispozitia de livrare nu poate fi finalizata!');
	}

	if (DsTrdr.utbl01 == 0) {
		X.EXCEPTION('Atentie: Metoda de plata nu este completata la nivelul clientului. Dispozitia de livrare nu poate fi finalizata!');
	}

	if (DsTrdr.payment == null) {
		X.EXCEPTION('Atentie: Termenul de plata nu este completat la nivelul clientului. Dispozitia de livrare nu poate fi finalizata!');
	}

	if ((!MTRDOC.SOCARRIER) || (MTRDOC.SOCARRIER == 0) || (MTRDOC.SOCARRIER == null)) {
		X.EXCEPTION('Atentie: Nu ati completat mod transport in oferta!..');
	}
	prelucrareServiciiAutomate();

	aCommand = 'XCMD:ClientImport,ScriptName:MecOfertaDL,myFindoc:' + SALDOC.FINDOC + ',myFPRMS:' + ceFprms;
	X.EXEC(aCommand);
}

function citestePret(ceMtrl, ceTrdr, ceStoc) {
	if (ceStoc > 0)
		ceShipment = 2;
	else
		ceShipment = 1;
	ceData = String.fromCharCode(39) + GetDateAsstring(SALDOC.TRNDATE) + String.fromCharCode(39);
	lcString = 'select ' +
		' (select TOP 1 socurrency from ccclistapret where mtrl=' + ceMtrl + ') as socurrency,' +
		' (select top 1 price ' +
		' from ccclistapret where fromdate<=' + ceData + ' and mtrl = ' + ceMtrl + ' order by fromdate desc) as price,' +
		' (select top 1 isnull(fld01,0)' +
		' from prcrdata where prcrule=2 and fromdate<=' + ceData + ' and dim1 = (select mtrcategory from mtrl where company=' + X.SYS.COMPANY + ' and sodtype=51 and mtrl=' + ceMtrl + ' )  order by fromdate desc) as markup,' +
		' (select top 1 isnull(fld01,0)' +
		' from prcrdata where prcrule=3 and fromdate<=' + ceData + ' and dim1 = ' + ceMtrl + ' order by fromdate desc) as markupart,' +
		' (select top 1 isnull(fld01,0)' +
		' from prcrdata where prcrule=4 and fromdate<=' + ceData + ' and dim1 = (select trdbusiness from trdr where company=' + X.SYS.COMPANY + ' and sodtype=13 and trdr=' + ceTrdr + ') and dim2= ' + ceShipment +
		' and dim3=(select mtrcategory from mtrl where company=' + X.SYS.COMPANY + ' and sodtype=51 and mtrl=' + ceMtrl + ' ) order by fromdate desc) as discount';
	DsPret = X.GETSQLDATASET(lcString, null);
	ceCurs = citesteCurs(DsPret.socurrency, SALDOC.SOCURRENCY);
	if (DsPret.markup == 0)
		ceMarkup = 1;
	else
		ceMarkup = DsPret.markup;

	if (DsPret.markupart == 0)
		ceMarkupArt = 1;
	else
		ceMarkupArt = DsPret.markupart;

	if ((DsPret.socurrency == 123) && (SALDOC.SOCURRENCY == 47))
		cePret = (DsPret.price * ceMarkup * ceMarkupArt) / ceCurs;
	else
		cePret = DsPret.price * ceMarkup * ceMarkupArt * ceCurs;

	return cePret;
}

function citestePretPromo(ceMtrl) {
	ceData = String.fromCharCode(39) + GetDateAsstring(SALDOC.TRNDATE) + String.fromCharCode(39);
	lcString = 'select ' +
		' (select TOP 1 socurrency from ccclistapret where mtrl=' + ceMtrl + ') as socurrency,' +
		' isnull(fld01,0) as price from prcrdata where prcrule=5 and fromdate<=' + ceData + ' and finaldate>DateAdd(d,1,' + ceData + ') and dim1 = ' + ceMtrl;
	DsPretPromo = X.GETSQLDATASET(lcString, null);
	if (DsPretPromo.price > 0) {
		ceCurs = citesteCurs(DsPretPromo.socurrency, SALDOC.SOCURRENCY);
		cePretPromo = DsPretPromo.price * ceCurs;
	} else
		cePretPromo = 0;

	return cePretPromo;
}

function citesteCurs(ceValutaArticol, ceValutaDocument) {
	//TipCurs = 1: RON->EUR
	//TipCurs = 2: EUR->RON

	ceData = String.fromCharCode(39) + GetDateAsstring(SALDOC.TRNDATE) + String.fromCharCode(39);
	if (ceValutaArticol == ceValutaDocument) {
		ceCurs = 1;
	}
	if (ceValutaArticol == 123) {
		if (ceValutaDocument == 47) {
			DsCurs = X.GETSQLDATASET('select curs from ccccurs where ' + ceData + ' between datastart and datastop and socurrency = 47 and isnull(ccctipcurs,0) = 1', null);
			ceCurs = DsCurs.curs;
		}
	}
	if (ceValutaArticol == 47) {
		if (ceValutaDocument == 123) {
			DsCurs = X.GETSQLDATASET('select curs from ccccurs where ' + ceData + ' between datastart and datastop and socurrency = 47 and isnull(ccctipcurs,0) = 2', null);
			ceCurs = DsCurs.curs;
		}
	}

	if (ceValutaArticol == 0)
		ceCurs = 1;

	return ceCurs;
}

function calculStocTotal(ceMtrl) {
	DsStoc = X.GETSQLDATASET('select sum(isnull(impqty1,0) - isnull(expqty1,0)) as stock from mtrbalsheet where company = ' + X.SYS.COMPANY + ' and fiscprd = ' + X.SYS.FISCPRD + ' and mtrl = ' + ceMtrl, null);
	lcString = 'SELECT (SUM(AA.QTY1)-SUM(AA.QTY1COV) - SUM(AA.QTY1CANC)) AS QTY1 ' +
		' FROM MTRLINES AA LEFT JOIN FINDOC BB ON AA.FINDOC=BB.FINDOC LEFT OUTER JOIN TRDR CC ON BB.TRDR = CC.TRDR LEFT JOIN RESTMODE RM ON AA.RESTMODE=RM.RESTMODE AND AA.COMPANY=RM.COMPANY ' +
		' WHERE ISNULL(BB.ISCANCEL,0) = 0 AND AA.COMPANY = ' + SALDOC.COMPANY + ' AND AA.PENDING  = 1 AND AA.COMPANY  = BB.COMPANY AND AA.SOSOURCE = BB.SOSOURCE ' +
		' AND AA.FINDOC = BB.FINDOC AND AA.QTY1<>0 AND RM.RESTCATEG = 2 AND AA.MTRL=' + ceMtrl;
	DsRezervari = X.GETSQLDATASET(lcString, null);
	ceStoc = DsStoc.stock - DsRezervari.qty1;
	if (ceStoc < 0)
		ceStoc = 0;
	return ceStoc;
}

function calculStocDepozit(ceMtrl, ceWhouse) {
	DsStoc = X.GETSQLDATASET('select sum(isnull(impqty1,0) - isnull(expqty1,0)) as stock from mtrbalsheet where company = '
			 + X.SYS.COMPANY + ' and fiscprd = ' + X.SYS.FISCPRD + ' and mtrl = ' + ceMtrl + ' and whouse = ' + ceWhouse, null);
	lcString = 'SELECT (SUM(AA.QTY1)-SUM(AA.QTY1COV) - SUM(AA.QTY1CANC)) AS QTY1 ' +
		' FROM MTRLINES AA LEFT JOIN FINDOC BB ON AA.FINDOC=BB.FINDOC LEFT OUTER JOIN TRDR CC ON BB.TRDR = CC.TRDR LEFT JOIN RESTMODE RM ON AA.RESTMODE=RM.RESTMODE AND AA.COMPANY=RM.COMPANY ' +
		' WHERE ISNULL(BB.ISCANCEL,0)=0 AND AA.COMPANY = ' + SALDOC.COMPANY + ' AND AA.PENDING  = 1 AND AA.COMPANY  = BB.COMPANY AND AA.SOSOURCE = BB.SOSOURCE ' +
		' AND AA.FINDOC = BB.FINDOC AND AA.QTY1<>0 AND RM.RESTCATEG = 2 AND AA.MTRL=' + ceMtrl + ' AND AA.WHOUSE = ' + ceWhouse;
	DsRezervari = X.GETSQLDATASET(lcString, null);
	ceStoc = DsStoc.stock - DsRezervari.qty1;
	if (ceStoc < 0)
		ceStoc = 0;
	return ceStoc;
}

function arataImagini(ceMtrl) {
	vCount = 0;
	DsFolder = X.GETSQLDATASET('select webpage, code2 from mtrl where company = ' + X.SYS.COMPANY + ' and sodtype=51 and mtrl = ' + ceMtrl, null);
	if (DsFolder.webpage.length > 0) {
		ceFolder = DsFolder.webpage;
		fso = new ActiveXObject("Scripting.FileSystemObject");
		f1 = fso.CreateTextFile("image.bat", true);
		var fsof = new ActiveXObject("Scripting.FileSystemObject");
		var dir = fsof.GetFolder(ceFolder);
		var fc = new Enumerator(dir.files);
		for (; !fc.atEnd(); fc.moveNext()) {
			pNameCurr = fc.item().Name;
			if (pNameCurr.search(DsFolder.code2) != -1) {
				vCount = vCount + 1;
				pNameCurr = ceFolder + '\\' + fc.item().Name;
				f1.WriteLine("start " + pNameCurr);
			}
		}
		f1.Close();

		if (vCount > 0) {
			var shellObj = new ActiveXObject("WSCript.Shell");
			shellObj.Run("image.bat", 1, true);
		} else {
			X.WARNING('Nu exista imagini pentru produs!..');
		}
		f1 = fso.GetFile("image.bat");
		f1.Delete();
	} else {
		X.WARNING('Nu exista folder definit pentru citirea imaginilor!..');
	}
}

function calculPretFinal() {
	ITELINES.CCCPRET = Math.round(ITELINES.TRNLINEVAL / ITELINES.QTY1 * 10000) / 10000;
}

function sePoateCreditaFaraAporb(ceTrdr) {
	if (SALDOC.FINDOC > 0) {
		DsAprobat = X.GETSQLDATASET('select findoc from CCCAPROBOFERTA where findoc=' + SALDOC.FINDOC, null);
		if (DsAprobat.findoc > 0)
			return false;
	}
	DsLimita = X.GETSQLDATASET('select isnull(t.crdlimit1,0) as crdlimit1, isnull(tx.utbl01,0) as metoda, (select shortcut from socurrency where socurrency=t.socurrency) as moneda from trdr t left join trdextra tx on t.company=tx.company and t.sodtype=tx.sodtype and t.trdr=tx.trdr where t.company = ' + X.SYS.COMPANY + ' and t.sodtype=13 and t.trdr = ' + ceTrdr, null);
	if (DsLimita.crdlimit1 > 0) {
		ceLimita = DsLimita.crdlimit1;
		ceSoldClient = soldClient(ceTrdr);
		ceSoldClient = Math.round(ceSoldClient * 100) / 100;
		ceSoldCec = soldCecuri(ceTrdr);
		ceSoldCec = Math.round(ceSoldCec * 100) / 100;
		ceSoldTotal = ceSoldClient + ceSoldCec;
		ceSoldTotal = Math.round(ceSoldTotal * 100) / 100;
		ceDepasire = ceSoldTotal - ceLimita;
		ceDepasire = Math.round(ceDepasire * 100) / 100;

		if (ceSoldTotal > ceLimita) {
			return false;
		}

		if (SALDOC.SUMAMNT > 0) {
			ceSoldTotalCurent = ceSoldTotal + SALDOC.SUMAMNT;
			if ((ceSoldTotalCurent > ceLimita) && (ceLimita > ceSoldTotal)) {
				return false;
			}
		}
	} else {
		return false;
	}

	return true;
}

function verificLimitaCredit(ceTrdr, ceMesaj) {
	//ceMesaj=1 => Interdictie
	//ceMesaj=2 => Avertisment

	if (SALDOC.FINDOC > 0) {
		DsAprobat = X.GETSQLDATASET('select findoc from CCCAPROBOFERTA where findoc=' + SALDOC.FINDOC, null);
		if (DsAprobat.findoc > 0) {
			ceMesaj = 2;
			X.SETPROPERTY('PANEL', 'pConv', 'VISIBLE', 'FALSE');
		}
	}
	DsLimita = X.GETSQLDATASET('select isnull(t.crdlimit1,0) as crdlimit1, isnull(tx.utbl01,0) as metoda, (select shortcut from socurrency where socurrency=t.socurrency) as moneda from trdr t left join trdextra tx on t.company=tx.company and t.sodtype=tx.sodtype and t.trdr=tx.trdr where t.company = ' + X.SYS.COMPANY + ' and t.sodtype=13 and t.trdr = ' + ceTrdr, null);
	//if (DsLimita.metoda == 10)
	//{
	//return 1;
	//}
	//else
	//{
	if (DsLimita.crdlimit1 > 0) {
		ceLimita = DsLimita.crdlimit1;
		ceSoldClient = soldClient(ceTrdr);
		ceSoldClient = Math.round(ceSoldClient * 100) / 100;
		ceSoldCec = soldCecuri(ceTrdr);
		ceSoldCec = Math.round(ceSoldCec * 100) / 100;
		ceSoldTotal = ceSoldClient + ceSoldCec;
		ceSoldTotal = Math.round(ceSoldTotal * 100) / 100;
		ceDepasire = ceSoldTotal - ceLimita;
		ceDepasire = Math.round(ceDepasire * 100) / 100;

		if (ceSoldTotal > ceLimita) {
			ceMoneda = ' ' + DsLimita.moneda;
			lcString = 'Atentie: Limita de credit depasita!..' + String.fromCharCode(13);
			lcString = lcString + 'Sold neacoperit: ' + ceSoldClient + ceMoneda + String.fromCharCode(13);
			lcString = lcString + 'CEC-uri neincasate: ' + ceSoldCec + ceMoneda + String.fromCharCode(13);
			lcString = lcString + 'Sold total: ' + ceSoldTotal + ceMoneda + String.fromCharCode(13);
			lcString = lcString + 'Limita de credit: ' + ceLimita + ceMoneda + String.fromCharCode(13);
			lcString = lcString + 'Depasire limita: ' + ceDepasire + ceMoneda + String.fromCharCode(13);
			if (ceMesaj == 1)
				X.EXCEPTION(lcString);
			else
				X.WARNING(lcString);

			X.SETPROPERTY('PANEL', 'pConv', 'VISIBLE', 'FALSE');
		}

		if (SALDOC.SUMAMNT > 0) {
			ceSoldTotalCurent = ceSoldTotal + SALDOC.SUMAMNT;
			if ((ceSoldTotalCurent > ceLimita) && (ceLimita > ceSoldTotal)) {
				ceMoneda = ' ' + DsLimita.moneda;
				ceDisponibil = ceLimita - ceSoldTotal;
				ceDisponibil = Math.round(ceDisponibil * 100) / 100;
				ceDocCurent = SALDOC.SUMAMNT;
				ceDocCurent = Math.round(ceDocCurent * 100) / 100;
				ceDepasire = ceDocCurent - ceDisponibil;
				ceDepasire = Math.round(ceDepasire * 100) / 100;
				lcString = 'Atentie: Limita de credit depasita!..' + String.fromCharCode(13);
				lcString = lcString + 'Sold neacoperit: ' + ceSoldClient + ceMoneda + String.fromCharCode(13);
				lcString = lcString + 'CEC-uri neincasate: ' + ceSoldCec + ceMoneda + String.fromCharCode(13);
				lcString = lcString + 'Sold total: ' + ceSoldTotal + ceMoneda + String.fromCharCode(13);
				lcString = lcString + 'Limita de credit: ' + ceLimita + ceMoneda + String.fromCharCode(13);
				lcString = lcString + 'Limita disponibila: ' + ceDisponibil + ceMoneda + String.fromCharCode(13) + String.fromCharCode(13);
				lcString = lcString + 'Document curent: ' + ceDocCurent + ceMoneda + String.fromCharCode(13);
				lcString = lcString + 'Depasire limita: ' + ceDepasire + ceMoneda + String.fromCharCode(13);
				if (ceMesaj == 1)
					X.EXCEPTION(lcString);
				else
					X.WARNING(lcString);
				X.SETPROPERTY('PANEL', 'pConv', 'VISIBLE', 'FALSE');
			}
		}
	} else {
		if (ceMesaj == 1)
			X.EXCEPTION('Clientul nu are definita limita de credit!..');
		else
			X.WARNING('Clientul nu are definita limita de credit!..');

		X.SETPROPERTY('PANEL', 'pConv', 'VISIBLE', 'FALSE');
	}

	X.SETPROPERTY('PANEL', 'pConv', 'VISIBLE', 'TRUE');
	//}
}

function soldClient(ceTrdr) {
	lcString = 'select sum(isnull(tp.flg01,0) * td.trnval - isnull(tp.flg02,0) * td.trnval) as sold from trdtrn td left join tprms tp on td.company=tp.company and td.sodtype=tp.sodtype and td.tprms=tp.tprms ' +
		'where td.company = ' + X.SYS.COMPANY + ' and td.sodtype = 13 and td.trdr = ' + ceTrdr;
	DsSold = X.GETSQLDATASET(lcString, null);
	return DsSold.sold;
}

function soldCecuri(ceTrdr) {
	lcString = 'select sum(tf1.lineval*isnull(cq1.chequeupd/abs(cq1.chequeupd),0)) as sold from trdflines tf1 ' +
		'left join chqtprms cq1 on tf1.tprms=cq1.tprms and tf1.sodtype=cq1.sodtype and tf1.company=cq1.company ' +
		' left join findoc f1 on tf1.findoc=f1.findoc left join cheque c on tf1.cheque = c.cheque ' +
		' where abs(isnull(cq1.chequeupd,0))>0 and c.trdrpublisher = ' + ceTrdr + ' and year(c.dateofs)>=2018';

	DsSoldCec = X.GETSQLDATASET(lcString, null);
	return DsSoldCec.sold;
}

function verificaCoreCharge() {
	if (ITELINES.BOOL01 == 0) {
		DsCore = X.GETSQLDATASET('select mtracn, isnull(relitem,0) as relitem from mtrl where company = ' + X.SYS.COMPANY + ' and sodtype = 51 and mtrl = ' + ITELINES.MTRL, null);
		if (DsCore.relitem > 0) {
			ceQty1 = ITELINES.QTY1;
			ceWhouse = ITELINES.WHOUSE;
			ITELINES.NEXT;
			DsMtrl = X.GETSQLDATASET('select isnull(mtracn,0) as mtracn from mtrl where company = ' + X.SYS.COMPANY + ' and sodtype=51 and mtrl = ' + ITELINES.MTRL, null);
			if ((DsMtrl.mtracn == 998) || (DsMtrl.mtracn == 997)) {
				ITELINES.MTRL = DsCore.relitem;
				ITELINES.QTY1 = ceQty1;
				ITELINES.WHOUSE = ceWhouse;
				ITELINES.POST;
			} else {
				ITELINES.APPEND;
				ITELINES.MTRL = DsCore.relitem;
				ITELINES.QTY1 = ceQty1;
				ITELINES.WHOUSE = ceWhouse;
				//ITELINES.POST;
			}
		}
	}
}

function verificaTaxaExo() {
	if (ITELINES.BOOL01 == 0) {
		DsTaxa = X.GETSQLDATASET('select mtracn, isnull(mx.num01,0) as num01 from mtrl m left join mtrextra mx on m.company=mx.company and m.sodtype=mx.sodtype and m.mtrl=mx.mtrl where m.company = ' + X.SYS.COMPANY + ' and m.sodtype = 51 and m.mtrl = ' + ITELINES.MTRL, null);
		if (DsTaxa.num01 > 0) {
			ceQty1 = ITELINES.QTY1;
			ceWhouse = ITELINES.WHOUSE;
			ITELINES.NEXT;
			DsMtrl = X.GETSQLDATASET('select isnull(mtracn,0) as mtracn from mtrl where company = ' + X.SYS.COMPANY + ' and sodtype=51 and mtrl = ' + ITELINES.MTRL, null);
			if ((DsMtrl.mtracn == 998) || (DsMtrl.mtracn == 997)) {
				ITELINES.MTRL = DsTaxa.num01;
				ITELINES.QTY1 = ceQty1;
				ITELINES.WHOUSE = ceWhouse;
				ITELINES.POST;
			} else {
				ITELINES.APPEND;
				ITELINES.MTRL = DsTaxa.num01;
				ITELINES.QTY1 = ceQty1;
				ITELINES.WHOUSE = ceWhouse;
				//ITELINES.POST;
			}
		}
	}
}

function afiseazaAlternative() {
	ceCaut = String.fromCharCode(39) + CCCSEARCHH.SEARCHTEXT + String.fromCharCode(39);
	ceCautAltRef = 0;
	DsAltRef = X.GETSQLDATASET('select count(*) as cate from mtrl where company = ' + X.SYS.COMPANY + ' and sodtype=51 and code1 = ' + ceCaut, null);
	if (DsAltRef.cate > 0)
		ceCautAltRef = 1;
	else
		ceCautAltRef = 0;

	CCCSEARCHL.FIRST;
	while (!CCCSEARCHL.Eof) {
		ceAltRef = CCCSEARCHL.ALTREF;
		ceMtrl = CCCSEARCHL.MTRL;
		if ((ceAltRef.length > 0) && (ceCautAltRef == 0)) {
			DsAlternative = X.GETSQLDATASET('select mtrl, isnull(mtrmanfctr,0) as mtrmanfctr from mtrl where company = ' + X.SYS.COMPANY + ' and sodtype=51 and code1 = ' +
					String.fromCharCode(39) + ceAltRef + String.fromCharCode(39) + ' and mtrl<>' + ceMtrl, null);
			DsAlternative.FIRST;
			while (!DsAlternative.Eof) {
				CCCSEARCHLALT.APPEND;
				CCCSEARCHLALT.MTRL = ceMtrl;
				CCCSEARCHLALT.MTRLALT = DsAlternative.mtrl;
				CCCSEARCHLALT.MTRMANFCTR = DsAlternative.mtrmanfctr;
				CCCSEARCHLALT.POST;
				DsAlternative.NEXT;
			}
		}
		CCCSEARCHL.NEXT;
	}
}

function calculTermenLivrare() {
	codStoc = '';
	if (ITELINES.CCCQTY1DEP > 0)
		codStoc = 'SD';
	else {
		if (ITELINES.CCCQTY1 > 0)
			codStoc = 'SC';
		else {
			codStoc = 'FZ';
		}
	}
	DsMesaj = X.GETSQLDATASET('select name from cccmesajelivrare where code = ' + String.fromCharCode(39) + codStoc + String.fromCharCode(39), null);
	if (codStoc == 'FZ') {
		ceZile1 = 0;
		ceZile2 = 0;
		DsTrdr = X.GETSQLDATASET('select * from ccctrdrcond where trdr = isnull((Select mtrsup from mtrl where mtrl= ' + ITELINES.MTRL + '),0)', null);
		DsTrdr.FIRST;
		while (!DsTrdr.Eof) {
			if (DsTrdr.shipment == 1)
				ceZile1 = DsTrdr.termenzile;
			if (DsTrdr.shipment == 2)
				ceZile2 = DsTrdr.termenzile;
			DsTrdr.NEXT;
		}
		ceMesaj = DsMesaj.name;
		ceMesaj = ceMesaj.replace('&Zi1', ceZile1);
		ceMesaj = ceMesaj.replace('&Zi2', ceZile2);
	} else
		ceMesaj = DsMesaj.name;
	DsMtrAcn = X.GETSQLDATASET('select mtracn from mtrl where company = ' + X.SYS.COMPANY + ' and sodtype = 51 and mtrl = ' + ITELINES.MTRL, null);
	if ((DsMtrAcn.mtracn == 997) || (DsMtrAcn.mtracn == 998) || (DsMtrAcn.mtracn == 999))
		ceMesaj = '';

	ITELINES.CCCLIVRARE = ceMesaj;

	DsBrand = X.GETSQLDATASET('select name from mtrmanfctr where mtrmanfctr = (select mtrmanfctr from mtrl where mtrl = ' + ITELINES.MTRL + ')', null);
	ITELINES.CCCBRAND = DsBrand.name;
}

function GetDateAsstring(aDt) {
	var strDt = '';
	/*
	calcDate = new Date(aDt);
	xYear = new String(calcDate.getFullYear());
	xMonth = calcDate.getMonth()+1;
	if (xMonth <10){
	xMonth = '0' + new String(xMonth);
	}
	xDay   = new String(calcDate.getDate());
	if (xDay <10){
	xDay = '0' + new String(xDay);
	}
	strDt = xYear+xMonth+xDay;
	return strDt;
	 */

	strDt = X.FORMATDATE('yyyymmdd', aDt);
	return strDt;
}

function afiseazaIstoric() {

	stergeLinii();
	var ceData1,
	ceData2;
	ceData1 = String.fromCharCode(39) + GetDateAsstring(CCCHISTALT.FROMDATEL) + String.fromCharCode(39);
	ceData2 = String.fromCharCode(39) + GetDateAsstring(CCCHISTALT.FROMDATEH) + String.fromCharCode(39);

	lsString = 'SELECT unikaINCT MT.CODE AS CodFacturare, MT.CODE1 as CodAlternativ, ROUND(M.LINEVAL/M.QTY1,2) AS PretUnitar, S.NAME AS Moneda,  H.NAME as Depozit, P.NAME2 AS Salesman,  F.TRNDATE as Data, SR.SERIES as Serie, F.FINCODE as Document,M.QTY1 as Cantitate, M.LINEVAL as Valoare FROM MTRLINES M LEFT JOIN MTRL MT ON M.MTRL=MT.MTRL LEFT JOIN WHOUSE H ON M.WHOUSE=H.WHOUSE LEFT JOIN MTRLOT L ON L.MTRLOT=M.MTRLOT,FINDOC F left join SOCURRENCY s on f.SOCURRENCY = s.SOCURRENCY left join SERIES SR on f.SERIES = sr.SERIES, TRDR T LEFT JOIN PRSN P ON T.SALESMAN = P.PRSN WHERE F.COMPANY=' + X.SYS.COMPANY + 'AND F.SOSOURCE=1351 AND (F.ISCANCEL=0 AND F.ORIGIN<>6) AND    F.FINDOC=M.FINDOC AND F.TRDR=T.TRDR AND MT.CODE=' + String.fromCharCode(39) + CCCHISTALT.CODE_ITEM_CODE + String.fromCharCode(39) + ' AND T.CODE = ' + String.fromCharCode(39) + SALDOC.TRDR_CUSTOMER_CODE + String.fromCharCode(39) + ' AND (F.TRNDATE >= ' + ceData1 + ' AND F.TRNDATE <= ' + ceData2 + ') AND SR.SERIES IN (' + CCCHISTALT.SERIES + ') ORDER BY TRNDATE DESC ';

	dsArticole = X.GETSQLDATASET(lsString, null);

	dsArticole.FIRST;
	while (!dsArticole.Eof) {
		CCCHISTORY.APPEND;

		CCCHISTORY.COD1 = dsArticole.CodFacturare;
		CCCHISTORY.COD2 = dsArticole.CodAlternativ;
		CCCHISTORY.PRETUNITAR = dsArticole.PretUnitar;
		CCCHISTORY.MONEDA = dsArticole.Moneda;
		CCCHISTORY.DEPOZIT = dsArticole.Depozit;
		CCCHISTORY.SALESMAN = dsArticole.Salesman;
		CCCHISTORY.DATA = dsArticole.Data;
		CCCHISTORY.SERIE = dsArticole.Serie;
		CCCHISTORY.DOCUMENT = dsArticole.Document;
		CCCHISTORY.CANTITATE = dsArticole.Cantitate;
		CCCHISTORY.VALOARE = dsArticole.Valoare;

		CCCHISTORY.POST;

		dsArticole.NEXT;
	}

	sSql = 'SELECT ISNULL(MT.CODE1,0) AS Code1 FROM MTRLINES M LEFT JOIN MTRL MT ON M.MTRL=MT.MTRL LEFT JOIN MTRLOT L ON L.MTRLOT=M.MTRLOT,FINDOC F left join SOCURRENCY s on f.SOCURRENCY = s.SOCURRENCY left join SERIES SR on f.SERIES = sr.SERIES, TRDR T LEFT JOIN PRSN P ON T.SALESMAN = P.PRSN WHERE F.COMPANY=' + X.SYS.COMPANY + 'AND F.SOSOURCE=1351 AND (F.ISCANCEL=0 AND F.ORIGIN<>6) AND    F.FINDOC=M.FINDOC AND F.TRDR=T.TRDR AND MT.CODE=' + String.fromCharCode(39) + CCCHISTALT.CODE_ITEM_CODE + String.fromCharCode(39) + ' AND T.CODE = ' + String.fromCharCode(39) + SALDOC.TRDR_CUSTOMER_CODE + String.fromCharCode(39) + 'AND (F.TRNDATE >= ' + ceData1 + ' AND F.TRNDATE <= ' + ceData2 + ') AND SR.SERIES IN (' + CCCHISTALT.SERIES + ') ORDER BY TRNDATE DESC';
	dsCod = X.GETSQLDATASET(sSql, null);
	if (dsCod.Code1 != 0) {

		lsString = 'SELECT unikaINCT MT.CODE AS CodFacturare, MT.CODE1 as CodAlternativ, ROUND(M.LINEVAL/M.QTY1,2) AS PretUnitar, S.NAME AS Moneda,  H.NAME as Depozit, P.NAME2 AS Salesman,  F.TRNDATE as Data, SR.SERIES as Serie, F.FINCODE as Document,M.QTY1 as Cantitate, M.LINEVAL as Valoare FROM MTRLINES M LEFT JOIN MTRL MT ON M.MTRL=MT.MTRL LEFT JOIN WHOUSE H ON M.WHOUSE=H.WHOUSE LEFT JOIN MTRLOT L ON L.MTRLOT=M.MTRLOT,FINDOC F left join SOCURRENCY s on f.SOCURRENCY = s.SOCURRENCY left join SERIES SR on f.SERIES = sr.SERIES, TRDR T LEFT JOIN PRSN P ON T.SALESMAN = P.PRSN WHERE F.COMPANY=' + X.SYS.COMPANY + 'AND F.SOSOURCE=1351 AND (F.ISCANCEL=0 AND F.ORIGIN<>6) AND    F.FINDOC=M.FINDOC AND F.TRDR=T.TRDR AND MT.CODE1=' + String.fromCharCode(39) + dsCod.Code1 + String.fromCharCode(39) + ' AND T.CODE = ' + String.fromCharCode(39) + SALDOC.TRDR_CUSTOMER_CODE + String.fromCharCode(39) + ' AND (F.TRNDATE >= ' + ceData1 + ' AND F.TRNDATE <= ' + ceData2 + ') AND SR.SERIES IN (' + CCCHISTALT.SERIES + ') ORDER BY TRNDATE DESC ';

		dsArticole = X.GETSQLDATASET(lsString, null);

		dsArticole.FIRST;
		while (!dsArticole.Eof) {
			CCCHISTORY1.APPEND;

			CCCHISTORY1.COD1 = dsArticole.CodFacturare;
			CCCHISTORY1.COD2 = dsArticole.CodAlternativ;
			CCCHISTORY1.PRETUNITAR = dsArticole.PretUnitar;
			CCCHISTORY1.MONEDA = dsArticole.Moneda;
			CCCHISTORY1.DEPOZIT = dsArticole.Depozit;
			CCCHISTORY1.SALESMAN = dsArticole.Salesman;
			CCCHISTORY1.DATA = dsArticole.Data;
			CCCHISTORY1.SERIE = dsArticole.Serie;
			CCCHISTORY1.DOCUMENT = dsArticole.Document;
			CCCHISTORY1.CANTITATE = dsArticole.Cantitate;
			CCCHISTORY1.VALOARE = dsArticole.Valoare;

			CCCHISTORY1.POST;

			dsArticole.NEXT;

		}

	}
}
function stergeLinii() {
	CCCHISTORY.FIRST;
	while (!CCCHISTORY.Eof()) {
		CCCHISTORY.DELETE;
	}

	CCCHISTORY1.FIRST;
	while (!CCCHISTORY1.Eof()) {
		CCCHISTORY1.DELETE;
	}
}

function findocID() {
	if (SALDOC.FINDOC > 0)
		vID = SALDOC.FINDOC;
	else
		vID = X.NEWID;

	return vID;
}

function ON_LOCATE() {
	if (SALDOC.TRDR) {
		y = sePoateCreditaFaraAporb(SALDOC.TRDR);
		if (!y) {
			//X.SETPROPERTY('PANEL', 'pBtn', 'VISIBLE', 'FALSE');
			//X.SETPROPERTY('FIELD', 'SALDOC.INT01', 'VISIBLE', 'TRUE');
		} else {
			X.WARNING('Peste limita de credit.');
			//X.SETPROPERTY('PANEL', 'pBtn', 'VISIBLE', 'TRUE');
			//X.SETPROPERTY('FIELD', 'SALDOC.INT01', 'VISIBLE', 'FALSE');
		}
	} else {
		X.SETPROPERTY('PANEL', 'pConv', 'VISIBLE', 'FALSE');
	}

	var q = 'select isnull(sum(isnull(qty1, 0)), 0) qty1, isnull(sum(dbo.convertit(m.mtrlines,m.findoc)), 0) qty1cov from mtrlines m where m.findoc=' + SALDOC.FINDOC,
	ds = X.GETSQLDATASET(q, null);

	q1 = ds.qty1;
	q1c = ds.qty1cov;

	if (!q1c) {
		updateFullyTr(0);
	}

	if (q1 && q1c && q1 == q1c && getFullyTr() == 1) {
		for (i = 0; i <= ITELINES.FIELDCOUNT - 1; i++) {
			X.SETPROPERTY('FIELD', 'ITELINES.' + ITELINES.FIELDNAME(i), 'READONLY', 1);
		}
	} else if (SALDOC.INT01 && getFullyTr() == 0 && q1c == 0) {
		//se executa ON_AFTERPOST in CCCAPROBOFERTA, asta inseamna ca am o aprobare pe findoc-ul acestei oferte
		var aprob = areAprobare(SALDOC.FINDOC, SALDOC.TRDR);			
		if (aprob) {
			if (!X.SQL('select isnull(itsme, 0) from cccaproboferta where cccaproboferta='+aprob, null)) {
				X.WARNING('Oferta a fost aprobata dar nu si convertita.\nCoversia se va produce acum.\n');
			}
			backgroundConv();
		}
	}
}

function areAprobare(findo, trd) {
	var aprob = X.SQL('select isnull(cccaproboferta, 0) aprobare from cccaproboferta where findoc=' + findo + ' and trdr=' + trd, null);
	if (aprob) {
		return aprob;
	} else {
		return false;
	}
}

/*
adauga in CCCAPROBOFERTA:
function ON_AFTERPOST() {
debugger;
var o = X.CreateObj('SALDOC;S1 - Oferte clienti');
try {
//localizeaza oferta aferenta si executa-i ON_LOCATE() care creaza docs daca nu a mai fost convertita:
o.DBLocate(CCCAPROBOFERTA.findoc);
} catch (err) {
X.WARNING(err.message);
} finally {
o.Free;
o=null;
}
}
 */

function getFullyTr() {
	return X.SQL('select fullytransf from findoc where findoc=' + SALDOC.FINDOC, null);
}
