/*
CCCSOAUDITVT:
SELECT DISTINCT A.MODULEID AS FINDOC,B.EMAIL,A.SOMODULE,B.NAME,A.DBDATE
FROM SOAUDIT A
INNER JOIN USERS B ON (A.USERS = B.USERS)
WHERE A.SOMODULE = 'SALDOC'
 */

function ON_CCCAPROBOFERTA_findoc() {
	DsFindoc = X.GETSQLDATASET('select isnull(t.crdlimit1,0) as crdlimit1, f.findoc, f.trndate, f.trdr, f.sumamnt from findoc f left join trdr t on f.trdr=t.trdr where f.company = ' + X.SYS.COMPANY + ' and f.sosource=1351 and f.fprms=7001 and f.findoc = ' + CCCAPROBOFERTA.findoc, null);

	CCCAPROBOFERTA.trdr = DsFindoc.trdr;

	CCCAPROBOFERTA.trndate = DsFindoc.trndate;

	CCCAPROBOFERTA.SUMAMNT = DsFindoc.sumamnt;

	CCCAPROBOFERTA.CRDLIMIT = DsFindoc.crdlimit1;

	lcString = 'select sum(sold) as sold, sum(intermen) as intermen, sum(depasit) as depasit, sum(soldcec) as soldcec from ' + ' (select ' + ' isnull(tamnt,0) * isnull(paydemandmd,0) * isnull(curs,0) - isnull(cuplat,0) * isnull(paydemandmd,0) * isnull(curs,0) + isnull(cec,0) * isnull(curs,0) - isnull(cecincasat,0) * isnull(curs,0) as sold, ' + ' case when DateDiff(d,getdate(),finaldate)>=0 then isnull(tamnt,0) * isnull(paydemandmd,0) * isnull(curs,0) - isnull(cuplat,0) * isnull(paydemandmd,0) * isnull(curs,0) + isnull(cec,0) * isnull(curs,0) - isnull(cecincasat,0) * isnull(curs,0) else 0 end as intermen, ' + ' case when DateDiff(d,getdate(),finaldate)<0 then isnull(tamnt,0) * isnull(paydemandmd,0) * isnull(curs,0) - isnull(cuplat,0) * isnull(paydemandmd,0) * isnull(curs,0) else 0 end as depasit, ' + ' isnull(cec,0) * isnull(curs,0) - isnull(cecincasat,0) * isnull(curs,0) as soldcec, abc.finaldate ' + ' from ' +
		' (select  isnull((select frate from rates where ratedate=getdate() and socurrency=f.socurrency),1) as curs, fp.trdr, fp.finaldate, fp.tamnt, fp.paydemandmd, f.socurrency, ' + ' isnull((select sum(tamnt) from ccccuplari where ffinpayterms=fp.finpayterms and itrndate<DateAdd(d,1,getdate())),0) + ' + ' isnull((select sum(tamnt) from ccccuplari where ifindoc=fp.findoc and itrdr=fp.trdr and itrdflines=fp.trdflines and ftrndate<DateAdd(d,1,getdate())),0) as cuplat,' + ' (select sum(tamnt) from cccfacturicec where ffinpayterms=fp.finpayterms and itrndate<DateAdd(d,1,getdate())) as cec, ' + ' (select sum(tamnt*a.incasat/isnull(a.valoare,0)) as incasat from ' + ' (select sum(llineval) as rest, sum(sold) as valoare, sum(incasat) as incasat, cheque from cccsoldcec where trndate<DateAdd(d,1,getdate()) group by cheque) a left join ' + ' (select tamnt, cheque, findoc, ffinpayterms from cccfacturicec where itrndate<DateAdd(d,1,getdate())) b on a.cheque=b.cheque ' +
		' where b.ffinpayterms=fp.finpayterms) as cecincasat ' + ' from finpayterms fp left join trdr t on fp.trdr=t.trdr ' + ' left join findoc f on fp.findoc=f.findoc ' + ' where isnull(f.iscancel,0)=0 and isnull(fp.paydemandmd,0) in (1,-1) and t.sodtype=13 and fp.trndate<DateAdd(d,1,getdate()) and 1=1  AND FP.TRDR=' + DsFindoc.trdr + ') abc ' + ' where (abs(abc.paydemandmd*abc.tamnt - abc.paydemandmd*abc.cuplat)>0.001 or abs(abc.cec-abc.cecincasat)>0.001)) abcd ';

	Ds = X.GETSQLDATASET(lcString, null);

	CCCAPROBOFERTA.SOLDTOTAL = Ds.sold;

	CCCAPROBOFERTA.SOLDSCADENT = Ds.depasit;

}
function ON_CCCAPROBOFERTA_seriesnum() {
	DsFindoc = X.GETSQLDATASET('select findoc from findoc where company = ' + X.SYS.COMPANY + '  and fiscprd= ' + X.SYS.FISCPRD + '  and sosource=1351 and fprms=7001 and seriesnum = ' + CCCAPROBOFERTA.seriesnum, null);

	try {
		CCCAPROBOFERTA.findoc = DsFindoc.findoc;
	} catch (err) {
		X.CANCELEDITS;
		X.WARNING('Nu exista documentul.');
	}
	finally {
		return;
	}

}
function EXECCOMMAND(cmd) {

	if (cmd == '20180115') {
		//-->SHOWS THE NEWLY CREATED DOC IN POP UP WINDOW
		aCommand = "XCMD:SALDOC[AUTOLOCATE=" + CCCAPROBOFERTA.findoc + ",FORM=S1 - Oferte clienti - Drepturi modificare]";
		X.EXEC(aCommand);

	}

	if (cmd == '20180405') {
		aCommand = "XCMD:CCCAGEING2[LIST=Mec - Ageing clienti,FORCEFILTERS=TRDR=" + CCCAPROBOFERTA.trdr + ",AUTOEXEC=1]";
		X.EXEC(aCommand);

	}

	if (cmd == '20200203') {
		if (CCCAPROBOFERTA.findoc) {
			X.OPENSUBFORM('SFAUDIT');
		}
	}
}

function ON_SFAUDIT_SHOW() {
	CCCSOAUDITVT.FIRST;
	while (!CCCSOAUDITVT.EOF) {
		CCCSOAUDITVT.DELETE;
	}

	var ds = X.GETSQLDATASET('SELECT DISTINCT A.USERS, B.EMAIL,B.NAME,DATEADD(dd, 0, DATEDIFF(DD, 0, A.DBDATE)) DBDATE '+
		'FROM SOAUDIT A ' +
		'INNER JOIN USERS B ON (A.USERS = B.USERS) ' +
		"WHERE A.SOMODULE = 'SALDOC' and a.moduleid="+CCCAPROBOFERTA.findoc, null);

	if (ds.RECORDCOUNT) {
		ds.FIRST;
		while (!ds.EOF) {
			CCCSOAUDITVT.APPEND;
			CCCSOAUDITVT.EMAIL = ds.EMAIL;
			CCCSOAUDITVT.DBDATE = ds.DBDATE;
			CCCSOAUDITVT.NAME = ds.NAME;
			CCCSOAUDITVT.POST;
			ds.NEXT;
		}
	}
}

function ON_SFAUDIT_ACCEPT() {
	if (CCCSOAUDITVT.EMAIL) {
		CCCAPROBOFERTA.EMAIL = CCCSOAUDITVT.EMAIL;
	}
}

function ON_AFTERPOST() {
	//debugger;
	X.RUNSQL('update cccaproboferta set itsme=1 where cccaproboferta='+CCCAPROBOFERTA.cccaproboferta, null);
	var o = X.CreateObj('SALDOC;S1 - Oferte clienti');
	try {
		//localizeaza oferta aferenta si executa-i ON_LOCATE() care creaza docs daca nu a mai fost convertita:
		o.DBLocate(CCCAPROBOFERTA.findoc);
	} catch (err) {
		X.WARNING(err.message);
	}
	finally {
		o.Free;
		o = null;
		X.RUNSQL('update cccaproboferta set itsme=0 where cccaproboferta='+CCCAPROBOFERTA.cccaproboferta, null);
	}
}
