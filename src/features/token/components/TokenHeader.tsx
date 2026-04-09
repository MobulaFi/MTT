'use client'
import { TokenDetailsResponse } from "@mobula_labs/types";
import { useEffect } from "react";
import { BaseHeaderData, DataHeader } from "@/components/shared/DataHeader";
import { PairHeaderSkeleton } from "@/components/skeleton";
import { useTokenData } from "@/features/token/hooks/useTokenData";
import { useTokenStore } from "@/features/token/store/useTokenStore";
import { useTradingDataStore } from "@/store/useTradingDataStore";
import { buildNativeSymbol } from "@mobula_labs/sdk";

function tokenToHeaderData(tokenData: TokenDetailsResponse['data']): BaseHeaderData {
    return {
        primaryToken: {
            address: tokenData?.address,
            symbol: tokenData?.symbol,
            name: tokenData?.name,
            logo: tokenData?.logo,
            priceUSD: tokenData?.priceUSD,
            blockchain: tokenData?.blockchain,
            marketCapUSD: tokenData?.marketCapUSD,
            marketCapDilutedUSD: tokenData?.marketCapDilutedUSD,
            deployer: tokenData?.deployer,
        },
        secondaryToken: {
            priceUSD: tokenData.priceToken,
            symbol: buildNativeSymbol(tokenData?.chainId)
        },
        address: tokenData?.address,
        liquidityUSD: tokenData?.liquidityUSD,
        totalFeesPaidUSD: tokenData?.totalFeesPaidUSD,
        socials: tokenData?.socials,
        exchangeName: tokenData.exchange?.name,
        exchangeLogo: tokenData.exchange?.logo,
        createdAt: tokenData.createdAt ?? undefined
        // No secondary token for single token view
        // No liquidity for single token view
    };
}

export function TokenHeader({
    token,
    address,
    blockchain,
}: {
    token: TokenDetailsResponse['data'] | null;
    address: string;
    blockchain: string;
}) {
    useTokenData(address, blockchain, token);
    const { setBaseToken } = useTradingDataStore();

    const liveToken = useTokenStore((state) => state.token);
    const tokenLoading = useTokenStore((state) => state.tokenLoading);
    const error = useTokenStore((state) => state.error);

    const tokenData = liveToken || token;
    
    // Set baseToken for trading panel
    useEffect(() => {
        if (tokenData) {
            setBaseToken({
                address: tokenData.address ?? '',
                symbol: tokenData.symbol ?? '',
                name: tokenData.name || undefined,
                logo: tokenData.logo || undefined,
                blockchain: tokenData.blockchain ?? blockchain,
                decimals: tokenData.decimals,
            });
        }
    }, [tokenData, blockchain, setBaseToken]);

    if (!tokenData) {
        return <PairHeaderSkeleton />;
    }

    const headerData = tokenToHeaderData(tokenData);

    return (
        <DataHeader
            data={headerData}
            isLoading={tokenLoading}
            SkeletonComponent={PairHeaderSkeleton}
        />
    );
}

