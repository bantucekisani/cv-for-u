const PURCHASES = {
  cv: {
    type: "cv",
    itemName: "CV Unlock",
    amountCents: 4000,
    credits: {
      downloadsRemaining: 4,
      coverLettersRemaining: 1
    }
  },
  "cover-letter": {
    type: "cover-letter",
    itemName: "AI Cover Letter",
    amountCents: 2500,
    credits: {
      coverLettersRemaining: 1
    }
  }
};

function getPurchaseConfig(type) {
  return PURCHASES[type] || null;
}

function formatAmount(amountCents) {
  return (amountCents / 100).toFixed(2);
}

function matchesAmount(config, amount) {
  return Math.abs(Number(amount || 0) - config.amountCents / 100) < 0.01;
}

module.exports = {
  PURCHASES,
  getPurchaseConfig,
  formatAmount,
  matchesAmount
};
