export async function fetchBatchedRows(ids, batchSize, fetchBatch) {
  if (!Number.isSafeInteger(batchSize) || batchSize < 1) {
    throw new RangeError('Batch size must be a positive integer.');
  }

  const rows = [];
  const concurrentBatches = 4;
  for (let offset = 0; offset < ids.length; offset += batchSize * concurrentBatches) {
    const batches = [];
    const batchEnd = Math.min(offset + batchSize * concurrentBatches, ids.length);
    for (let batchOffset = offset; batchOffset < batchEnd; batchOffset += batchSize) {
      batches.push(ids.slice(batchOffset, batchOffset + batchSize));
    }
    const pages = await Promise.all(batches.map(fetchBatch));
    pages.forEach(page => rows.push(...page));
  }
  return rows;
}
