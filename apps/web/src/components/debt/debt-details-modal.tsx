import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Landmark, TrendingDown, Clock, IndianRupee, AlertTriangle, CalendarCheck2 } from "lucide-react";
import { Progress } from "@/components/ui/progress";

interface DebtDetailsModalProps {
  isOpen: boolean;
  onClose: () => void;
  debt: any;
  status: any;
}

export function DebtDetailsModal({ isOpen, onClose, debt, status }: DebtDetailsModalProps) {
  if (!debt || !status) return null;

  // Simulate future payoff
  const simulatePayoff = () => {
    let balance = status.currentBalance;
    const payment = debt.minimumPayment;
    const monthlyRate = (debt.interestRate / 100) / 12;
    
    let months = 0;
    let totalFutureInterest = 0;
    
    while (balance > 0.01 && months < 360) {
      const interest = balance * monthlyRate;
      totalFutureInterest += interest;
      balance += interest;
      
      if (payment <= interest) {
        return { neverPayOff: true, months: 0, totalFutureInterest: 0 };
      }
      
      balance -= payment;
      months++;
    }
    
    return { neverPayOff: false, months, totalFutureInterest };
  };

  const simulation = simulatePayoff();
  
  const payoffDate = new Date();
  payoffDate.setMonth(payoffDate.getMonth() + simulation.months);
  
  const totalLifetimeInterest = status.totalInterestPaid + simulation.totalFutureInterest;
  const totalCostOfLoan = debt.originalBalance + totalLifetimeInterest;
  const totalPaidSoFar = status.totalPrincipalPaid + status.totalInterestPaid;
  
  const formatCurrency = (amount: number) => `₹${Math.round(amount).toLocaleString('en-IN')}`;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-lg md:max-w-xl max-h-[85vh] overflow-y-auto">
        <DialogHeader className="mb-4">
          <DialogTitle className="flex items-center gap-3 text-2xl pr-8">
            <div className="p-2 bg-primary/10 rounded-full shrink-0">
              <Landmark className="h-6 w-6 text-primary" />
            </div>
            <span className="truncate">{debt.name}</span>
            <span className="ml-auto shrink-0 text-sm font-normal bg-secondary px-3 py-1 rounded-full text-muted-foreground">
              {debt.interestRate}% APR
            </span>
          </DialogTitle>
        </DialogHeader>

        <div className="grid grid-cols-2 gap-4 mb-6">
          <div className="bg-card border rounded-xl p-4 shadow-sm flex flex-col justify-center">
            <p className="text-sm font-medium text-muted-foreground flex items-center gap-2 mb-1">
              <IndianRupee className="h-4 w-4" /> Current Balance
            </p>
            <p className="text-2xl sm:text-3xl font-bold text-foreground tracking-tight">
              {formatCurrency(status.currentBalance)}
            </p>
            {status.accruedInterest > 0 && (
              <p className="text-[10px] text-red-400 mt-1">
                +{formatCurrency(status.accruedInterest)} un-posted interest
              </p>
            )}
          </div>
          
          <div className="bg-card border rounded-xl p-4 shadow-sm flex flex-col justify-center">
            <p className="text-sm font-medium text-muted-foreground flex items-center gap-2 mb-1">
              <Clock className="h-4 w-4" /> Time Remaining
            </p>
            {simulation.neverPayOff ? (
              <p className="text-lg font-bold text-red-500 flex items-center gap-1">
                <AlertTriangle className="h-4 w-4" /> Never
              </p>
            ) : (
              <div>
                <p className="text-2xl sm:text-3xl font-bold text-foreground tracking-tight">
                  {simulation.months} <span className="text-sm font-normal text-muted-foreground">months</span>
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  Payoff: {payoffDate.toLocaleDateString('default', { month: 'short', year: 'numeric' })}
                </p>
              </div>
            )}
          </div>
        </div>

        {simulation.neverPayOff && (
          <div className="bg-red-500/10 border border-red-500/20 text-red-600 dark:text-red-400 p-4 rounded-xl mb-6 flex items-start gap-3 text-sm">
            <AlertTriangle className="h-5 w-5 shrink-0 mt-0.5" />
            <p>
              <strong>Warning:</strong> Your monthly payment of {formatCurrency(debt.minimumPayment)} is less than the monthly interest accumulating on this loan. You will never pay off this debt at this rate. Please increase your minimum payment.
            </p>
          </div>
        )}

        <div className="space-y-6">
          {/* Past Breakdown */}
          <div className="space-y-3">
            <h3 className="text-lg font-semibold border-b pb-2">History (Paid So Far)</h3>
            <div className="bg-muted/30 p-4 rounded-xl space-y-4">
              <div className="flex justify-between items-end">
                <div>
                  <p className="text-xs text-muted-foreground uppercase tracking-wider font-semibold mb-1">Total Paid</p>
                  <p className="text-xl font-bold">{formatCurrency(totalPaidSoFar)}</p>
                </div>
                <div className="text-right">
                  <p className="text-xs text-muted-foreground mb-1">Principal vs Interest</p>
                  <p className="text-sm font-medium">
                    <span className="text-emerald-500">{Math.round((status.totalPrincipalPaid / totalPaidSoFar || 0) * 100)}%</span>
                    {" / "}
                    <span className="text-red-400">{Math.round((status.totalInterestPaid / totalPaidSoFar || 0) * 100)}%</span>
                  </p>
                </div>
              </div>
              <Progress 
                value={(status.totalPrincipalPaid / totalPaidSoFar) * 100} 
                className="w-full h-2 bg-red-400/20" 
                trackClassName="h-2 bg-red-400/20" 
                indicatorClassName="bg-emerald-500" 
              />
              <div className="flex justify-between text-xs">
                <span className="text-emerald-500 font-medium">{formatCurrency(status.totalPrincipalPaid)} Principal</span>
                <span className="text-red-400 font-medium">{formatCurrency(status.totalInterestPaid)} Interest</span>
              </div>
            </div>
          </div>

          {/* Future Projection */}
          {!simulation.neverPayOff && (
            <div className="space-y-3">
              <h3 className="text-lg font-semibold border-b pb-2">Future Projection</h3>
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-muted/30 p-4 rounded-xl text-center flex flex-col justify-center">
                  <p className="text-[10px] sm:text-xs text-muted-foreground uppercase tracking-wider font-semibold mb-1">Future Interest</p>
                  <p className="text-lg sm:text-xl font-bold text-red-400">{formatCurrency(simulation.totalFutureInterest)}</p>
                </div>
                <div className="bg-muted/30 p-4 rounded-xl text-center flex flex-col justify-center">
                  <p className="text-[10px] sm:text-xs text-muted-foreground uppercase tracking-wider font-semibold mb-1">Est. Completion</p>
                  <p className="text-lg sm:text-xl font-bold text-primary flex items-center justify-center gap-1 sm:gap-2">
                    <CalendarCheck2 className="h-5 w-5" />
                    {payoffDate.toLocaleDateString('default', { month: 'short', year: '2-digit' })}
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Lifetime Summary */}
          <div className="bg-primary/5 border border-primary/10 p-4 rounded-xl">
            <h4 className="text-sm font-semibold mb-3 flex items-center gap-2">
              <TrendingDown className="h-4 w-4 text-primary" /> Lifetime Summary
            </h4>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Original Borrowed</span>
                <span className="font-medium">{formatCurrency(debt.originalBalance)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Total Lifetime Interest</span>
                <span className="font-medium text-red-400">{formatCurrency(totalLifetimeInterest)}</span>
              </div>
              <div className="border-t pt-2 mt-2 flex justify-between font-bold">
                <span>Total Cost of Loan</span>
                <span className="text-lg">{formatCurrency(totalCostOfLoan)}</span>
              </div>
            </div>
          </div>
        </div>

      </DialogContent>
    </Dialog>
  );
}
