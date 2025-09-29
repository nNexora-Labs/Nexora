'use client';

import { useState } from 'react';
import {
  Box,
  Typography,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Button,
  Chip,
  TextField,
  MenuItem,
  FormControl,
  InputLabel,
  Select,
  IconButton,
  Tooltip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  CircularProgress,
  Alert,
  Divider,
  Grid,
  Card,
  CardContent,
} from '@mui/material';
import {
  Search,
  FilterList,
  Download,
  Visibility,
  Refresh,
  Clear,
  GetApp,
} from '@mui/icons-material';
import useTransactionHistory, { TransactionHistoryItem, ExportOptions } from '../hooks/useTransactionHistory';

interface TransactionHistoryTableProps {
  isDarkMode?: boolean;
}

export default function TransactionHistoryTable({ isDarkMode = false }: TransactionHistoryTableProps) {
  const {
    transactions,
    filters,
    setFilters,
    searchTerm,
    setSearchTerm,
    isLoading,
    error,
    loadTransactions,
    exportToCSV,
    exportToJSON,
    clearFilters,
    totalTransactions,
    filteredCount
  } = useTransactionHistory();

  const [showFilters, setShowFilters] = useState(false);
  const [showExportDialog, setShowExportDialog] = useState(false);
  const [exportOptions, setExportOptions] = useState<ExportOptions>({
    format: 'csv',
    includeFields: ['txHash', 'eventType', 'assets', 'timestamp', 'status'],
    dateRange: {
      from: '',
      to: ''
    }
  });

  const handleExport = () => {
    if (exportOptions.format === 'csv') {
      exportToCSV(exportOptions);
    } else {
      exportToJSON(exportOptions);
    }
    setShowExportDialog(false);
  };

  const getEventTypeColor = (eventType: string) => {
    switch (eventType) {
      case 'Supply': return 'success';
      case 'Withdraw': return 'info';
      case 'Borrow': return 'warning';
      case 'Repay': return 'primary';
      case 'Liquidation': return 'error';
      default: return 'default';
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'Success': return 'success';
      case 'Pending': return 'warning';
      case 'Failed': return 'error';
      default: return 'default';
    }
  };

  if (error) {
    return (
      <Alert severity="error" sx={{ mb: 2 }}>
        {error}
      </Alert>
    );
  }

  return (
    <Box>
      {/* Header */}
      <Box sx={{ mb: 3 }}>
        <Typography variant="h6" gutterBottom>
          Transaction History
        </Typography>
        <Typography variant="body2" color="text.secondary">
          {filteredCount} of {totalTransactions} transactions
        </Typography>
      </Box>

      {/* Search and Filter Bar */}
      <Card sx={{ mb: 3, borderRadius: '8px' }}>
        <CardContent sx={{ p: 2 }}>
          <Grid container spacing={2} alignItems="center">
            <Grid item xs={12} sm={6} md={4}>
              <TextField
                fullWidth
                size="small"
                placeholder="Search transactions..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                InputProps={{
                  startAdornment: <Search sx={{ mr: 1, color: 'text.secondary' }} />
                }}
              />
            </Grid>
            <Grid item xs={12} sm={6} md={8}>
              <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                <Button
                  size="small"
                  variant="outlined"
                  startIcon={<FilterList />}
                  onClick={() => setShowFilters(!showFilters)}
                >
                  Filters
                </Button>
                <Button
                  size="small"
                  variant="outlined"
                  startIcon={<GetApp />}
                  onClick={() => setShowExportDialog(true)}
                >
                  Export
                </Button>
                <Button
                  size="small"
                  variant="outlined"
                  startIcon={<Refresh />}
                  onClick={loadTransactions}
                  disabled={isLoading}
                >
                  Refresh
                </Button>
              </Box>
            </Grid>
          </Grid>

          {/* Filters */}
          {showFilters && (
            <>
              <Divider sx={{ my: 2 }} />
              <Grid container spacing={2}>
                <Grid item xs={12} sm={6} md={3}>
                  <FormControl fullWidth size="small">
                    <InputLabel>Event Type</InputLabel>
                    <Select
                      value={filters.eventType}
                      onChange={(e) => setFilters({ ...filters, eventType: e.target.value })}
                      label="Event Type"
                    >
                      <MenuItem value="">All</MenuItem>
                      <MenuItem value="Supply">Supply</MenuItem>
                      <MenuItem value="Withdraw">Withdraw</MenuItem>
                      <MenuItem value="Borrow">Borrow</MenuItem>
                      <MenuItem value="Repay">Repay</MenuItem>
                      <MenuItem value="Liquidation">Liquidation</MenuItem>
                    </Select>
                  </FormControl>
                </Grid>
                <Grid item xs={12} sm={6} md={3}>
                  <TextField
                    fullWidth
                    size="small"
                    label="Asset"
                    value={filters.asset}
                    onChange={(e) => setFilters({ ...filters, asset: e.target.value })}
                    placeholder="e.g., cWETH"
                  />
                </Grid>
                <Grid item xs={12} sm={6} md={3}>
                  <FormControl fullWidth size="small">
                    <InputLabel>Status</InputLabel>
                    <Select
                      value={filters.status}
                      onChange={(e) => setFilters({ ...filters, status: e.target.value })}
                      label="Status"
                    >
                      <MenuItem value="">All</MenuItem>
                      <MenuItem value="Success">Success</MenuItem>
                      <MenuItem value="Pending">Pending</MenuItem>
                      <MenuItem value="Failed">Failed</MenuItem>
                    </Select>
                  </FormControl>
                </Grid>
                <Grid item xs={12} sm={6} md={3}>
                  <Box sx={{ display: 'flex', gap: 1, alignItems: 'center', height: '100%' }}>
                    <Button
                      size="small"
                      variant="outlined"
                      startIcon={<Clear />}
                      onClick={clearFilters}
                      sx={{ flex: 1 }}
                    >
                      Clear
                    </Button>
                  </Box>
                </Grid>
              </Grid>
            </>
          )}
        </CardContent>
      </Card>

      {/* Transaction Table */}
      <Card sx={{ borderRadius: '8px' }}>
        <TableContainer>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>Transaction</TableCell>
                <TableCell>Type</TableCell>
                <TableCell>Asset(s)</TableCell>
                <TableCell>Amount(s)</TableCell>
                <TableCell>APY</TableCell>
                <TableCell>Vault</TableCell>
                <TableCell>Date</TableCell>
                <TableCell>Status</TableCell>
                <TableCell>Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={9} sx={{ textAlign: 'center', py: 4 }}>
                    <CircularProgress />
                    <Typography variant="body2" sx={{ mt: 1 }}>
                      Loading transactions...
                    </Typography>
                  </TableCell>
                </TableRow>
              ) : transactions.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={9} sx={{ textAlign: 'center', py: 4 }}>
                    <Typography variant="body2" color="text.secondary">
                      No transactions found
                    </Typography>
                  </TableCell>
                </TableRow>
              ) : (
                transactions.map((tx) => (
                  <TableRow key={tx.id} hover>
                    <TableCell>
                      <Box>
                        <Typography variant="body2" sx={{ fontFamily: 'monospace', fontSize: '0.75rem' }}>
                          {tx.txHash.slice(0, 10)}...{tx.txHash.slice(-8)}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          Block #{tx.blockNumber}
                        </Typography>
                      </Box>
                    </TableCell>
                    <TableCell>
                      <Chip
                        label={tx.eventType}
                        size="small"
                        color={getEventTypeColor(tx.eventType)}
                        variant="outlined"
                      />
                    </TableCell>
                    <TableCell>
                      {tx.assets.map((asset, index) => (
                        <Typography key={index} variant="body2">
                          {asset.token}
                        </Typography>
                      ))}
                    </TableCell>
                    <TableCell>
                      {tx.assets.map((asset, index) => (
                        <Typography key={index} variant="body2" sx={{ fontFamily: 'monospace' }}>
                          {asset.amount}
                        </Typography>
                      ))}
                    </TableCell>
                    <TableCell>
                      {tx.apy && (
                        <Chip label={tx.apy} size="small" color="success" variant="outlined" />
                      )}
                    </TableCell>
                    <TableCell>
                      {tx.assets.map((asset, index) => (
                        <Typography key={index} variant="caption" sx={{ fontFamily: 'monospace', display: 'block' }}>
                          {asset.vault ? `${asset.vault.slice(0, 6)}...${asset.vault.slice(-4)}` : '-'}
                        </Typography>
                      ))}
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2">{tx.date}</Typography>
                    </TableCell>
                    <TableCell>
                      <Chip
                        label={tx.status}
                        size="small"
                        color={getStatusColor(tx.status)}
                      />
                    </TableCell>
                    <TableCell>
                      <Tooltip title="View on Etherscan">
                        <IconButton
                          size="small"
                          onClick={() => window.open(tx.explorerUrl, '_blank')}
                        >
                          <Visibility />
                        </IconButton>
                      </Tooltip>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </TableContainer>
      </Card>

      {/* Export Dialog */}
      <Dialog open={showExportDialog} onClose={() => setShowExportDialog(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Export Transaction History</DialogTitle>
        <DialogContent>
          <Grid container spacing={2} sx={{ mt: 1 }}>
            <Grid item xs={12}>
              <FormControl fullWidth>
                <InputLabel>Format</InputLabel>
                <Select
                  value={exportOptions.format}
                  onChange={(e) => setExportOptions({ ...exportOptions, format: e.target.value as 'csv' | 'json' })}
                  label="Format"
                >
                  <MenuItem value="csv">CSV</MenuItem>
                  <MenuItem value="json">JSON</MenuItem>
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={6}>
              <TextField
                fullWidth
                label="From Date"
                type="date"
                value={exportOptions.dateRange.from}
                onChange={(e) => setExportOptions({
                  ...exportOptions,
                  dateRange: { ...exportOptions.dateRange, from: e.target.value }
                })}
                InputLabelProps={{ shrink: true }}
              />
            </Grid>
            <Grid item xs={6}>
              <TextField
                fullWidth
                label="To Date"
                type="date"
                value={exportOptions.dateRange.to}
                onChange={(e) => setExportOptions({
                  ...exportOptions,
                  dateRange: { ...exportOptions.dateRange, to: e.target.value }
                })}
                InputLabelProps={{ shrink: true }}
              />
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowExportDialog(false)}>Cancel</Button>
          <Button onClick={handleExport} variant="contained" startIcon={<Download />}>
            Export
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
