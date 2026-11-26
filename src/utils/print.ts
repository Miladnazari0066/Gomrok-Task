import { EntryDoc, Batch, ExitDoc } from '../types';
import { fa, fmtJ, todayJ, esc } from './jalali';

export interface BatchPrintOptions {
  exitCottage?: string;
  ownerCompany?: string;
}

function triggerHtmlPrint(html: string) {
  const printViaIframe = () => {
    const iframe = document.createElement('iframe');
    iframe.style.position = 'fixed';
    iframe.style.right = '0';
    iframe.style.bottom = '0';
    iframe.style.width = '0';
    iframe.style.height = '0';
    iframe.style.border = '0';
    document.body.appendChild(iframe);
    const doc = iframe.contentWindow?.document;
    if (!doc || !iframe.contentWindow) {
      document.body.removeChild(iframe);
      return;
    }
    doc.open();
    doc.write(html);
    doc.close();
    setTimeout(() => {
      try {
        iframe.contentWindow?.focus();
        iframe.contentWindow?.print();
      } catch (e) {
        console.error(e);
      } finally {
        setTimeout(() => {
          if (iframe.parentNode) iframe.parentNode.removeChild(iframe);
        }, 1200);
      }
    }, 350);
  };

  try {
    const w = window.open('', '_blank', 'width=900,height=700');
    if (!w) {
      printViaIframe();
      return;
    }
    w.document.write(html);
    w.document.close();
    w.focus();
    setTimeout(() => {
      try {
        w.print();
      } catch (e) {
        console.error(e);
      }
    }, 400);
  } catch {
    printViaIframe();
  }
}

export function buildBatchReceiptsPrintHtml(
  batch: Batch,
  memberDocs: EntryDoc[],
  options: BatchPrintOptions = {}
): string {
  const uniqueOwners = Array.from(
    new Set(memberDocs.map((d) => String(d.importer || '').trim()).filter(Boolean))
  );
  const ownerCompany =
    String(options.ownerCompany || '').trim() ||
    uniqueOwners.join(' / ') ||
    '—';

  const exitCottageClean = String(options.exitCottage || '').trim();
  const exitCottageDisplay = exitCottageClean ? fa(exitCottageClean) : '—';

  const distinctGoods = Array.from(
    new Set(memberDocs.map((d) => String(d.goods || '').trim()).filter(Boolean))
  ).join(' / ');
  const goodsLabel = String(batch.goods || '').trim() || distinctGoods || '—';

  const totalPallets = memberDocs.reduce(
    (sum, d) => sum + Math.max(0, Math.floor(Number(d.pallets) || 0)),
    0
  );

  const rows = memberDocs
    .map(
      (d, idx) => `
    <tr>
      <td class="col-idx">${fa(idx + 1)}</td>
      <td class="col-receipt">${esc(d.receipt?.number) || '—'}</td>
      <td class="col-pallets">${fa(Math.max(0, Math.floor(Number(d.pallets) || 0)))} پالت</td>
    </tr>`
    )
    .join('');

  return `<!DOCTYPE html>
<html dir="rtl" lang="fa">
<head>
  <meta charset="UTF-8">
  <title>قبض‌های انبار تجمیع‌شده${exitCottageClean ? ` — کوتاژ خروج ${esc(fa(exitCottageClean))}` : ''}</title>
  <style>
    * { font-family: Tahoma, Arial, sans-serif; box-sizing: border-box; }
    body { padding: 28px 32px; color: #111827; background: #ffffff; margin: 0; }
    .sheet { max-width: 820px; margin: 0 auto; min-height: calc(100vh - 56px); display: flex; flex-direction: column; }
    .header { border-bottom: 2.5px solid #1f2937; padding-bottom: 14px; margin-bottom: 18px; text-align: center; }
    .header h1 { font-size: 22px; margin: 0 0 8px 0; color: #0f172a; font-weight: bold; }
    .header-sub { display: flex; justify-content: center; align-items: center; gap: 18px; flex-wrap: wrap; font-size: 14px; color: #1e293b; }
    .cottage-pill { display: inline-block; background: #f1f5f9; border: 1.5px solid #334155; padding: 4px 14px; border-radius: 6px; font-weight: bold; font-size: 14px; }
    .owner-banner { margin-top: 10px; font-size: 15px; font-weight: bold; color: #0f172a; }
    .meta-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 10px 18px; background: #f8fafc; border: 1px solid #cbd5e1; border-radius: 8px; padding: 14px 18px; margin-bottom: 20px; font-size: 13px; line-height: 1.8; }
    .meta-item { display: flex; justify-content: space-between; gap: 8px; border-bottom: 1px dashed #e2e8f0; padding-bottom: 6px; }
    .meta-item:last-child { border-bottom: none; }
    .meta-label { color: #475569; font-weight: bold; }
    .meta-val { color: #0f172a; font-weight: bold; }
    table { width: 100%; border-collapse: collapse; margin-top: 4px; }
    th, td { border: 1px solid #334155; padding: 10px 14px; font-size: 13px; }
    th { background: #e2e8f0; color: #0f172a; font-weight: bold; text-align: center; }
    td.col-idx { width: 70px; text-align: center; color: #475569; }
    td.col-receipt { text-align: center; font-weight: bold; font-size: 14px; letter-spacing: 0.4px; }
    td.col-pallets { width: 180px; text-align: center; font-weight: bold; }
    tfoot td { background: #f1f5f9; font-weight: bold; font-size: 14px; color: #0f172a; text-align: center; }
    .footer { margin-top: auto; padding-top: 24px; border-top: 1.5px solid #cbd5e1; text-align: center; font-size: 15px; font-weight: bold; color: #0f172a; }
    @media print {
      body { padding: 14px 18px; }
      .sheet { min-height: calc(100vh - 28px); }
    }
  </style>
</head>
<body>
  <div class="sheet">
    <div class="header">
      <h1>قبض‌های انبار تجمیع‌شده</h1>
      <div class="header-sub">
        <span class="cottage-pill">کوتاژ خروج: ${esc(exitCottageDisplay)}</span>
      </div>
      <div class="owner-banner">
        صاحب کالا (شرکت): ${esc(ownerCompany)}
      </div>
    </div>

    <div class="meta-grid">
      <div class="meta-item">
        <span class="meta-label">نوع کالا:</span>
        <span class="meta-val">${esc(goodsLabel)}</span>
      </div>
      <div class="meta-item">
        <span class="meta-label">تاریخ تجمیع:</span>
        <span class="meta-val">${esc(fmtJ(batch.createdAt))}</span>
      </div>
      <div class="meta-item">
        <span class="meta-label">شماره پرونده:</span>
        <span class="meta-val">${esc(fa(batch.file))}</span>
      </div>
      <div class="meta-item">
        <span class="meta-label">تعداد کل قبض‌های انبار تجمیع‌شده:</span>
        <span class="meta-val">${fa(memberDocs.length)} قبض انبار</span>
      </div>
      <div class="meta-item" style="grid-column: span 2; border-bottom: none; padding-bottom: 0;">
        <span class="meta-label">تعداد کل پالت‌ها:</span>
        <span class="meta-val">${fa(totalPallets)} پالت</span>
      </div>
    </div>

    <table>
      <thead>
        <tr>
          <th>ردیف</th>
          <th>شماره قبض انبار</th>
          <th>تعداد پالت</th>
        </tr>
      </thead>
      <tbody>
        ${rows || '<tr><td colspan="3" style="text-align:center">هیچ قبض انباری یافت نشد</td></tr>'}
      </tbody>
      <tfoot>
        <tr>
          <td colspan="2">جمع کل (${fa(memberDocs.length)} قبض انبار)</td>
          <td>${fa(totalPallets)} پالت</td>
        </tr>
      </tfoot>
    </table>

    <div class="footer">
      ${esc(ownerCompany)}
    </div>
  </div>
</body>
</html>`;
}

export function printBatchReceipts(
  batch: Batch,
  memberDocs: EntryDoc[],
  options: BatchPrintOptions = {}
) {
  const html = buildBatchReceiptsPrintHtml(batch, memberDocs, options);
  triggerHtmlPrint(html);
}

export function printExitReceipts(
  exitDoc: ExitDoc,
  batch: Batch | undefined,
  memberDocs: EntryDoc[]
) {
  const rows = memberDocs
    .map(
      (d) => `
    <tr>
      <td>${fa(d.cottage)}</td>
      <td>${esc(d.bl)}</td>
      <td>${esc(d.receipt.number) || '—'}</td>
      <td>${esc(d.goods) || '—'}</td>
      <td>${esc(d.brand) || '—'}</td>
      <td>${esc(d.receipt.count) || '—'}</td>
      <td>${d.pallets ? fa(d.pallets) : '—'}</td>
    </tr>`
    )
    .join('');

  const html = `<!DOCTYPE html>
<html dir="rtl" lang="fa">
<head>
  <meta charset="UTF-8">
  <title>مجوز خروج کالا ${fa(exitDoc.cottage)}</title>
  <style>
    * { font-family: Tahoma, Arial, sans-serif; box-sizing: border-box; }
    body { padding: 30px; color: #000; background: #fff; }
    .header { display: flex; justify-content: space-between; align-items: center; border-bottom: 2px solid #333; padding-bottom: 12px; margin-bottom: 16px; }
    h1 { font-size: 20px; margin: 0; }
    .meta { color: #222; font-size: 13px; margin: 10px 0 18px; line-height: 2; background: #f5f5f5; padding: 14px; border-radius: 6px; border: 1px solid #ccc; }
    table { width: 100%; border-collapse: collapse; margin-top: 10px; }
    th, td { border: 1px solid #555; padding: 9px 12px; text-align: right; font-size: 13px; }
    th { background: #eee; font-weight: bold; }
    .foot { margin-top: 24px; font-size: 12px; color: #555; border-top: 1px solid #ccc; padding-top: 12px; display: flex; justify-content: space-between; }
    .seal { display: inline-block; border: 2px solid #16a34a; color: #16a34a; font-weight: bold; padding: 4px 16px; border-radius: 4px; font-size: 14px; margin-top: 10px; }
    @media print { body { padding: 15px; } }
  </style>
</head>
<body>
  <div class="header">
    <h1>پایانه گمرک — پروانه و قبض‌های خروج کالا</h1>
    <div>تاریخ صادر: ${fmtJ(todayJ())}</div>
  </div>
  <div class="meta">
    <b>کوتاژ خروج:</b> ${fa(exitDoc.cottage)} &nbsp;|&nbsp;
    <b>بارنامه خروج:</b> ${esc(exitDoc.bl)} &nbsp;|&nbsp;
    <b>شماره پرونده:</b> ${fa(exitDoc.file)} &nbsp;|&nbsp;
    <b>تجمیع مربوطه:</b> ${esc(String(exitDoc.batchId))}<br>
    <b>شرکت واردکننده:</b> ${esc(exitDoc.importer)} &nbsp;|&nbsp;
    <b>شرکت حمل‌ونقل:</b> ${esc(exitDoc.carrier)}<br>
    <b>نوع کالا:</b> ${esc(exitDoc.goods)} &nbsp;|&nbsp;
    <b>برند:</b> ${esc(exitDoc.brand) || '—'} &nbsp;|&nbsp;
    <b>تریلی / پالت:</b> ${fa(exitDoc.trailers)} تریلی / ${fa(exitDoc.pallets)} پالت
    ${
      exitDoc.partialExit?.isPartial
        ? `<div style="margin-top: 10px; background: #fffbeb; border: 1.5px dashed #d97706; padding: 8px 12px; border-radius: 6px; font-size: 13px; color: #92400e;">
            <b>⚠️ وضعیت خروج درصدی (پارت‌بندی بار تجمیع):</b><br>
            • سهم خروجی این مجوز: <b>${fa(exitDoc.partialExit.exitPercent)}٪ (${fa(exitDoc.partialExit.exitPallets)} پالت)</b> &nbsp;|&nbsp;
            • سهم باقی‌مانده در انبار گمرک: <b>${fa(exitDoc.partialExit.remainingPercent)}٪ (${fa(exitDoc.partialExit.remainingPallets)} پالت)</b><br>
            • مجموع کل بار تجمیع: <b>${fa(exitDoc.partialExit.totalPallets)} پالت</b>
          </div>`
        : ''
    }
    <div>
      <span class="seal">تاییدیه تشریفات خروج گمرکی صادر شد ✓</span>
    </div>
  </div>
  <table>
    <thead>
      <tr>
        <th>شماره کوتاژ ورود</th>
        <th>شماره بارنامه</th>
        <th>شماره قبض انبار</th>
        <th>نوع کالا</th>
        <th>برند</th>
        <th>تعداد اقلام</th>
        <th>تعداد پالت</th>
      </tr>
    </thead>
    <tbody>
      ${rows || '<tr><td colspan="7" style="text-align:center">اقلام تجمیعی یافت نشد</td></tr>'}
    </tbody>
  </table>
  <div class="foot">
    <span>تعداد اقلام تجمیعی خروجی: ${fa(memberDocs.length)}</span>
    <span>صادرشده جهت ارائه به درب خروج گمرک پایانه</span>
  </div>
</body>
</html>`;

  const w = window.open('', '_blank', 'width=900,height=700');
  if (!w) {
    alert('لطفاً پنجره‌های بازشو (Pop-up) را در مرورگر خود مجاز کنید.');
    return;
  }
  w.document.write(html);
  w.document.close();
  w.focus();
  setTimeout(() => {
    try {
      w.print();
    } catch (e) {
      console.error(e);
    }
  }, 400);
}
